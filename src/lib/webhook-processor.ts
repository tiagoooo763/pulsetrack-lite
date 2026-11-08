import crypto from "crypto";
import {
  insertWebhookEvent,
  resolveTransactionStatus,
  upsertTransaction,
  upsertTransfer,
} from "./db";
import {
  ALL_OMEGAPAY_WEBHOOK_EVENTS,
  OMEGAPAY_CHARGEBACK_EVENTS,
  OMEGAPAY_TRANSACTION_EVENTS,
  OMEGAPAY_TRANSFER_EVENTS,
  type OmegaPayOrderItem,
  type OmegaPayTransferStatus,
  type OmegaPayWebhookEvent,
  type OmegaPayWebhookFee,
} from "./omegapay-types";
import {
  sanitizeData,
  safeLog,
  verifyOmegaPayWebhookToken,
} from "./sanitize";

export interface WebhookProcessResult {
  ok: boolean;
  statusCode: number;
  duplicate?: boolean;
  event?: string;
  entityId?: string;
  statusAfter?: string | null;
  error?: string;
}

function isKnownWebhookEvent(event: string): event is OmegaPayWebhookEvent {
  return (ALL_OMEGAPAY_WEBHOOK_EVENTS as readonly string[]).includes(event);
}

function extractProductInfo(payload: Record<string, unknown>): {
  productId: string | null;
  productName: string;
} {
  const tx = (payload.transaction || {}) as Record<string, unknown>;
  const rawOrderItems =
    (Array.isArray(payload.orderItems) ? payload.orderItems : null) ||
    (Array.isArray(tx.orderItems) ? tx.orderItems : null) ||
    (Array.isArray(payload.items) ? payload.items : null);

  if (rawOrderItems && rawOrderItems.length > 0) {
    const first = rawOrderItems[0] as OmegaPayOrderItem;
    const prodName = first?.product?.name?.trim() || "Produto OmegaPay";
    const prodId = first?.product?.id || first?.product?.externalId || null;
    if (rawOrderItems.length > 1) {
      return {
        productId: prodId ? String(prodId) : null,
        productName: `${prodName} (+${rawOrderItems.length - 1})`,
      };
    }
    return {
      productId: prodId ? String(prodId) : null,
      productName: prodName,
    };
  }

  const dataObj = (payload.data || {}) as Record<string, unknown>;
  const dataProduct = (dataObj.product || {}) as Record<string, unknown>;
  if (typeof dataProduct.name === "string" && dataProduct.name.trim()) {
    return {
      productId: dataProduct.id ? String(dataProduct.id) : null,
      productName: dataProduct.name.trim(),
    };
  }

  return {
    productId: null,
    productName: "Produto OmegaPay",
  };
}

export async function processOmegaPayWebhook(
  rawBody: unknown,
  configuredWebhookTokens: string
): Promise<WebhookProcessResult> {
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return {
      ok: false,
      statusCode: 400,
      error: "Payload JSON inválido.",
    };
  }

  const payload = rawBody as Record<string, unknown>;
  const event = typeof payload.event === "string" ? payload.event.trim() : "";
  const token = payload.token;

  // 1. Validação oficial do token antes de qualquer regra de negócio ou persistência
  if (!configuredWebhookTokens || !configuredWebhookTokens.trim()) {
    safeLog(
      "error",
      "Tentativa de recebimento de webhook sem OMEGAPAY_WEBHOOK_TOKEN configurado no servidor."
    );
    return {
      ok: false,
      statusCode: 503,
      error: "Token de validação de webhook não configurado no servidor.",
    };
  }

  if (!verifyOmegaPayWebhookToken(token, configuredWebhookTokens)) {
    safeLog("warn", "Webhook rejeitado: token de validação inválido.", {
      event: event || "UNKNOWN",
    });
    return {
      ok: false,
      statusCode: 401,
      error: "Token de validação inválido.",
    };
  }

  // 2. Validação do identificador oficial do evento
  if (!event || !isKnownWebhookEvent(event)) {
    safeLog("warn", "Webhook rejeitado: evento desconhecido ou ausente.", {
      event,
    });
    return {
      ok: false,
      statusCode: 400,
      error: `Evento não reconhecido pela especificação oficial da OmegaPay: ${event || "(vazio)"}`,
    };
  }

  // 3. Sanitização rigorosa (remove CPF, CNPJ, telefone, dados bancários, endereço e token)
  const sanitizedPayload = sanitizeData(payload);

  // 4. Determinação da entidade e chave de idempotência
  let entityId = "";
  let statusAfter: string | null = null;
  let dedupeKey = "";

  const isTransactionEvent = (
    OMEGAPAY_TRANSACTION_EVENTS as readonly string[]
  ).includes(event);
  const isTransferEvent = (
    OMEGAPAY_TRANSFER_EVENTS as readonly string[]
  ).includes(event);
  const isChargebackEvent = (
    OMEGAPAY_CHARGEBACK_EVENTS as readonly string[]
  ).includes(event);

  if (isTransactionEvent || (event === "SUBSCRIPTION_RENEWED" && payload.transaction)) {
    const tx = (payload.transaction || {}) as Record<string, unknown>;
    if (typeof tx.id !== "string" || !tx.id.trim()) {
      return {
        ok: false,
        statusCode: 400,
        error: "Campo transaction.id obrigatório ausente no evento de transação.",
      };
    }
    entityId = tx.id.trim();
    const resolvedStatus = resolveTransactionStatus(
      event,
      typeof tx.status === "string" ? tx.status : undefined
    );
    statusAfter = resolvedStatus;
    const grossAmount = Number(tx.amount ?? tx.chargeAmount ?? 0);
    const feeSig =
      typeof tx.commissionAmount === "number"
        ? `comm:${tx.commissionAmount}`
        : Array.isArray(payload.fees)
          ? `fees:${(payload.fees as OmegaPayWebhookFee[]).reduce((s, f) => s + Number(f.amount || 0), 0)}`
          : "nofee";
    dedupeKey = `${event}:${entityId}:${resolvedStatus}:${grossAmount}:${feeSig}`;
  } else if (isTransferEvent) {
    const withdraw = (payload.withdraw || {}) as Record<string, unknown>;
    if (typeof withdraw.id !== "string" || !withdraw.id.trim()) {
      return {
        ok: false,
        statusCode: 400,
        error: "Campo withdraw.id obrigatório ausente no evento de transferência.",
      };
    }
    entityId = withdraw.id.trim();
    const rawWithdrawStatus =
      typeof withdraw.status === "string" ? withdraw.status.toUpperCase() : "PENDING";
    statusAfter =
      event === "TRANSFER_COMPLETED"
        ? "COMPLETED"
        : event === "TRANSFER_FAILED"
          ? rawWithdrawStatus === "CANCELED"
            ? "CANCELED"
            : "FAILED"
          : rawWithdrawStatus;
    const receivedAmount = Number(withdraw.receivedAmount ?? 0);
    dedupeKey = `${event}:${entityId}:${statusAfter}:${receivedAmount}`;
  } else if (isChargebackEvent) {
    const cb = (payload.chargeback || {}) as Record<string, unknown>;
    const tx = (payload.transaction || {}) as Record<string, unknown>;
    entityId = String(cb.id || tx.id || "chargeback");
    statusAfter = String(cb.status || tx.status || "PENDING");
    dedupeKey = `${event}:${entityId}:${statusAfter}:${ String(cb.updatedAt || cb.createdAt || "") }`;
  } else {
    const sub = (payload.subscription || {}) as Record<string, unknown>;
    entityId = String(
      sub.id || payload.checkoutSessionGuid || "event_entity"
    );
    statusAfter = String(
      sub.status || payload.checkoutSessionStatus || "ACTIVE"
    );
    const payloadHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(sanitizedPayload))
      .digest("hex")
      .slice(0, 16);
    dedupeKey = `${event}:${entityId}:${statusAfter}:${payloadHash}`;
  }

  // 5. Registro idempotente do evento no banco de dados
  const inserted = await insertWebhookEvent({
    dedupeKey,
    eventType: event,
    entityId,
    statusAfter,
    sanitizedPayload,
  });

  if (inserted.duplicate) {
    safeLog("info", "Evento de webhook duplicado ignorado com idempotência.", {
      event,
      entityId,
    });
    return {
      ok: true,
      statusCode: 200,
      duplicate: true,
      event,
      entityId,
      statusAfter,
    };
  }

  // 6. Atualização de transações (sem duplicar registros)
  if (
    isTransactionEvent ||
    (event === "SUBSCRIPTION_RENEWED" && payload.transaction) ||
    (isChargebackEvent && payload.transaction)
  ) {
    const tx = (payload.transaction || {}) as Record<string, unknown>;
    if (typeof tx.id === "string" && tx.id.trim()) {
      const grossAmount = Number(tx.amount ?? tx.chargeAmount ?? 0);
      let feeAmount: number | null = null;
      let netAmount: number | null = null;

      if (typeof tx.commissionAmount === "number" && tx.commissionAmount >= 0) {
        netAmount = Number(tx.commissionAmount.toFixed(2));
        feeAmount = Math.max(0, Number((grossAmount - netAmount).toFixed(2)));
      } else if (Array.isArray(payload.fees) && payload.fees.length > 0) {
        const totalFees = (payload.fees as OmegaPayWebhookFee[]).reduce(
          (acc, f) => acc + Number(f?.amount || 0),
          0
        );
        feeAmount = Math.max(0, Number(totalFees.toFixed(2)));
        netAmount = Math.max(0, Number((grossAmount - feeAmount).toFixed(2)));
      }

      const { productId, productName } = extractProductInfo(payload);
      const resolvedStatus = resolveTransactionStatus(
        event,
        typeof tx.status === "string" ? tx.status : undefined
      );

      const createdAt =
        (typeof tx.createdAt === "string" && tx.createdAt) ||
        (typeof tx.createAt === "string" && tx.createAt) ||
        new Date().toISOString();

      const paidAt =
        typeof tx.payedAt === "string" && tx.payedAt
          ? tx.payedAt
          : resolvedStatus === "COMPLETED"
            ? createdAt
            : null;

      await upsertTransaction({
        id: tx.id.trim(),
        clientIdentifier:
          typeof tx.identifier === "string" ? tx.identifier : null,
        orderId: typeof payload.orderId === "string" ? payload.orderId : null,
        productId,
        productName,
        offerCode:
          typeof payload.offerCode === "string" ? payload.offerCode : null,
        paymentMethod:
          typeof tx.paymentMethod === "string" ? tx.paymentMethod : "PIX",
        currency: typeof tx.currency === "string" ? tx.currency : "BRL",
        grossAmount,
        feeAmount,
        netAmount,
        status: resolvedStatus,
        lastEvent: event,
        installments:
          typeof tx.installments === "number" ? tx.installments : 1,
        createdAt,
        paidAt,
      });
    }
  }

  // 7. Atualização de transferências / recebimentos
  if (isTransferEvent) {
    const withdraw = (payload.withdraw || {}) as Record<string, unknown>;
    if (typeof withdraw.id === "string" && withdraw.id.trim()) {
      const amount = Number(withdraw.amount ?? 0);
      const feeAmount = Number(withdraw.feeAmount ?? 0);
      const receivedAmount =
        typeof withdraw.receivedAmount === "number"
          ? Number(withdraw.receivedAmount)
          : statusAfter === "COMPLETED"
            ? Math.max(0, amount - feeAmount)
            : 0;

      await upsertTransfer({
        id: withdraw.id.trim(),
        clientIdentifier:
          typeof withdraw.clientIdentifier === "string"
            ? withdraw.clientIdentifier
            : null,
        amount,
        receivedAmount,
        feeAmount,
        currency:
          typeof withdraw.currency === "string" ? withdraw.currency : "BRL",
        status: (statusAfter || "PENDING") as OmegaPayTransferStatus,
        lastEvent: event,
        message:
          typeof withdraw.message === "string" ? withdraw.message : null,
        createdAt:
          typeof withdraw.createdAt === "string"
            ? withdraw.createdAt
            : new Date().toISOString(),
        updatedAt:
          typeof withdraw.updatedAt === "string"
            ? withdraw.updatedAt
            : new Date().toISOString(),
      });
    }
  }

  safeLog("info", "Webhook OmegaPay processado com sucesso.", {
    event,
    entityId,
    statusAfter,
  });

  return {
    ok: true,
    statusCode: 200,
    duplicate: false,
    event,
    entityId,
    statusAfter,
  };
}
