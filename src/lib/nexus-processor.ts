import {
  insertWebhookEvent,
  resolveTransactionStatus,
  upsertTransaction,
  type OmegaPayTransactionStatus,
} from "./db";
import { safeLog, sanitizeData } from "./sanitize";
import { timingSafeStringCompare } from "./auth";

export interface ProcessNexusWebhookResult {
  ok: boolean;
  duplicate: boolean;
  error?: string;
  transactionId?: string;
  statusAfter?: string;
}

/**
 * Normaliza e processa webhooks do gateway Nexus (Nexus Pay / Nexus Gateway).
 * Suporta payloads com estrutura aninhada ({ event, data: { ... } }) ou plana ({ id, status, amount, ... }).
 */
export async function processNexusWebhook(
  payload: Record<string, unknown>,
  configuredToken?: string
): Promise<ProcessNexusWebhookResult> {
  try {
    // 1. Validação de token se configurado
    if (configuredToken && configuredToken.trim()) {
      const incomingToken = String(
        payload.token ||
        payload.webhook_token ||
        payload.secret ||
        payload.api_key ||
        ""
      ).trim();

      if (!timingSafeStringCompare(incomingToken, configuredToken.trim())) {
        safeLog("warn", "Webhook Nexus rejeitado: token de autenticação inválido.");
        return {
          ok: false,
          duplicate: false,
          error: "Token do webhook Nexus inválido.",
        };
      }
    }

    // 2. Extrai dados do payload (compatível com padrões comuns da Nexus)
    const dataObj =
      payload.data && typeof payload.data === "object"
        ? (payload.data as Record<string, unknown>)
        : payload;

    const rawId =
      dataObj.id ||
      dataObj.transaction_id ||
      dataObj.transactionId ||
      dataObj.order_id ||
      payload.id ||
      payload.transaction_id ||
      payload.orderId;

    if (!rawId) {
      return {
        ok: false,
        duplicate: false,
        error: "Identificador da transação Nexus ausente no payload.",
      };
    }

    const transactionId = String(rawId);

    // 3. Identifica o evento / status
    const rawEvent = String(
      payload.event ||
      payload.eventType ||
      payload.action ||
      dataObj.event ||
      dataObj.status ||
      payload.status ||
      "TRANSACTION_PAID"
    );

    const upperEvent = rawEvent.toUpperCase();

    // 4. Extrai valores monetários (com suporte a centavos ou float)
    let grossAmount = 0;
    const rawGross =
      dataObj.amount ??
      dataObj.gross_amount ??
      dataObj.grossAmount ??
      dataObj.total ??
      dataObj.value ??
      payload.amount;

    if (typeof rawGross === "number") {
      grossAmount = rawGross;
    } else if (typeof rawGross === "string") {
      grossAmount = Number(rawGross.replace(",", ".")) || 0;
    }

    // Se o valor estiver em centavos inteiros grandes (ex: 19700 para R$ 197,00)
    if (
      Number.isInteger(grossAmount) &&
      grossAmount >= 1000 &&
      !String(rawGross).includes(".")
    ) {
      grossAmount = grossAmount / 100;
    }

    let feeAmount = 0;
    const rawFee =
      dataObj.fee ??
      dataObj.fee_amount ??
      dataObj.feeAmount ??
      dataObj.tax ??
      payload.fee;

    if (typeof rawFee === "number") {
      feeAmount = rawFee;
    } else if (typeof rawFee === "string") {
      feeAmount = Number(rawFee.replace(",", ".")) || 0;
    }

    if (
      Number.isInteger(feeAmount) &&
      feeAmount >= 500 &&
      !String(rawFee).includes(".")
    ) {
      feeAmount = feeAmount / 100;
    }

    let netAmount = 0;
    const rawNet =
      dataObj.net_amount ??
      dataObj.netAmount ??
      dataObj.commission ??
      payload.net_amount;

    if (typeof rawNet === "number") {
      netAmount = rawNet;
    } else if (typeof rawNet === "string") {
      netAmount = Number(rawNet.replace(",", ".")) || 0;
    } else {
      netAmount = Math.max(0, Number((grossAmount - feeAmount).toFixed(2)));
    }

    if (
      Number.isInteger(netAmount) &&
      netAmount >= 1000 &&
      !String(rawNet).includes(".")
    ) {
      netAmount = netAmount / 100;
    }

    // 5. Determina o status normalizado
    let status: OmegaPayTransactionStatus = "PENDING";
    if (
      upperEvent.includes("PAID") ||
      upperEvent.includes("APPROVED") ||
      upperEvent.includes("CONFIRMED") ||
      upperEvent === "COMPLETED"
    ) {
      status = "COMPLETED";
    } else if (upperEvent.includes("REFUND")) {
      status = "REFUNDED";
    } else if (upperEvent.includes("CHARGEBACK")) {
      status = "CHARGED_BACK";
    } else if (
      upperEvent.includes("CANCEL") ||
      upperEvent.includes("EXPIRED") ||
      upperEvent.includes("REJECT")
    ) {
      status = "CANCELED";
    }

    // 6. Produto, Pagamento e Cliente
    const productObj =
      dataObj.product && typeof dataObj.product === "object"
        ? (dataObj.product as Record<string, unknown>)
        : null;

    const productName = String(
      productObj?.name ||
      dataObj.product_name ||
      dataObj.productName ||
      payload.product_name ||
      "Produto Nexus Pay"
    );

    const paymentMethod = String(
      dataObj.payment_method ||
      dataObj.paymentMethod ||
      dataObj.method ||
      payload.payment_method ||
      "PIX"
    ).toUpperCase();

    const customerObj =
      dataObj.customer && typeof dataObj.customer === "object"
        ? (dataObj.customer as Record<string, unknown>)
        : null;

    const clientIdentifier = customerObj?.name
      ? String(customerObj.name)
      : customerObj?.email
      ? String(customerObj.email)
      : dataObj.clientIdentifier
      ? String(dataObj.clientIdentifier)
      : null;

    // 7. Idempotência por dedupeKey
    const dedupeKey = `nexus_${transactionId}_${status}_${rawEvent}`;
    const sanitizedPayload = sanitizeData(payload);

    const webhookResult = await insertWebhookEvent({
      dedupeKey,
      eventType: rawEvent,
      entityId: transactionId,
      statusAfter: status,
      sanitizedPayload,
    });

    if (webhookResult.duplicate) {
      safeLog("info", "Webhook Nexus duplicado ignorado com idempotência.", {
        transactionId,
        event: rawEvent,
      });
      return {
        ok: true,
        duplicate: true,
        transactionId,
        statusAfter: status,
      };
    }

    // 8. Salva transação no banco com gateway = 'NEXUS'
    const now = new Date().toISOString();
    await upsertTransaction({
      id: transactionId,
      gateway: "NEXUS",
      clientIdentifier,
      productName,
      paymentMethod,
      currency: "BRL",
      grossAmount,
      feeAmount,
      netAmount,
      status,
      lastEvent: rawEvent,
      createdAt: (dataObj.created_at || payload.created_at || now) as string,
      paidAt: status === "COMPLETED" ? now : null,
    });

    safeLog("info", "Webhook Nexus processado com sucesso.", {
      transactionId,
      status,
      grossAmount,
      gateway: "NEXUS",
    });

    return {
      ok: true,
      duplicate: false,
      transactionId,
      statusAfter: status,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    safeLog("error", "Erro ao processar webhook Nexus.", { error: message });
    return {
      ok: false,
      duplicate: false,
      error: message,
    };
  }
}
