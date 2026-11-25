import crypto from "crypto";
import {
  getTransactionById,
  insertTransactionStatusHistory,
  insertWebhookEvent,
  recordApprovedSaleNotification,
  resolveTransactionStatus,
  touchGatewayIntegrationEvent,
  upsertTransaction,
  type GatewayIntegrationRecord,
  type OmegaPayTransactionStatus,
} from "./db";
import { decryptSecret } from "./token-crypto";
import { timingSafeStringCompare } from "./auth";
import { safeLog, sanitizeData } from "./sanitize";
import { toIsoTimestamp, toNullableIsoTimestamp } from "./date-utils";

export const ELEVYPAY_DASHBOARD_URL =
  "https://app.elevypay.com/client-integrations.php";
export const ELEVYPAY_PUBLIC_WEBHOOK_ORIGIN = "https://www.usedashfy.com.br";

export interface ElevyPayWebhookAuthInput {
  rawBody: string;
  payload: Record<string, unknown>;
  headers: Headers;
  queryToken?: string | null;
  integration: GatewayIntegrationRecord;
}

export interface ElevyPayWebhookAuthResult {
  valid: boolean;
  reason?: string;
}

export interface ProcessElevyPayWebhookResult {
  ok: boolean;
  statusCode: number;
  duplicate: boolean;
  transactionId?: string;
  externalTransactionId?: string;
  statusBefore?: string | null;
  statusAfter?: OmegaPayTransactionStatus;
  eventType?: string;
  saleNotificationCreated?: boolean;
  error?: string;
}

/**
 * Gera um segredo criptograficamente forte e individual para webhooks da ElevyPay.
 */
export function generateElevyPayWebhookSecret(): string {
  return `elv_whsec_${crypto.randomBytes(32).toString("hex")}`;
}

/**
 * Monta a URL individual de webhook da ElevyPay para a conta do usuário.
 */
export function buildElevyPayWebhookUrl(
  slug: string,
  origin: string = ELEVYPAY_PUBLIC_WEBHOOK_ORIGIN
): string {
  const cleanOrigin = origin.replace(/\/+$/, "");
  return `${cleanOrigin}/api/webhooks/elevypay?i=${encodeURIComponent(slug)}`;
}

/**
 * Gera identificador de transação interno determinístico e isolado por usuário,
 * impedindo colisões caso dois usuários recebam IDs numéricos idênticos da ElevyPay.
 */
export function buildScopedElevyPayTransactionId(
  userId: string,
  externalTxId: string
): string {
  const userTag = crypto
    .createHash("sha256")
    .update(userId, "utf8")
    .digest("hex")
    .slice(0, 10);
  const safeExternal = externalTxId.trim().slice(0, 100);
  return `elevy_${userTag}_${safeExternal}`;
}

function extractBearerToken(headers: Headers): string {
  const auth = headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return "";
}

function extractIncomingToken(
  headers: Headers,
  queryToken: string | null | undefined,
  payload: Record<string, unknown>
): string {
  const fromHeaders =
    headers.get("x-elevypay-token") ||
    headers.get("x-elevy-token") ||
    headers.get("x-webhook-token") ||
    headers.get("x-api-token") ||
    extractBearerToken(headers) ||
    "";
  if (fromHeaders.trim()) return fromHeaders.trim();

  if (queryToken && queryToken.trim()) {
    return queryToken.trim();
  }

  const fromBody =
    payload.token ??
    payload.webhook_token ??
    payload.webhookToken ??
    payload.secret ??
    "";
  return typeof fromBody === "string" ? fromBody.trim() : "";
}

function extractIncomingSignature(headers: Headers): string {
  const raw =
    headers.get("x-elevypay-signature") ||
    headers.get("x-elevy-signature") ||
    headers.get("x-webhook-signature") ||
    headers.get("x-signature") ||
    headers.get("x-hub-signature-256") ||
    "";
  return raw.trim();
}

export function verifyHmacSha256Signature(
  rawBody: string,
  secret: string,
  incomingSignature: string
): boolean {
  const cleaned = incomingSignature
    .trim()
    .replace(/^sha256=/i, "")
    .toLowerCase();
  if (!cleaned || !/^[0-9a-f]{64}$/.test(cleaned)) {
    return false;
  }
  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  const a = Buffer.from(cleaned, "hex");
  const b = Buffer.from(expectedHex, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Valida a autenticidade da requisição de webhook da ElevyPay conforme o modo configurado.
 * Nunca aceita requisições sem credencial válida configurada.
 */
export function verifyElevyPayWebhookAuth(
  input: ElevyPayWebhookAuthInput
): ElevyPayWebhookAuthResult {
  const { integration, rawBody, payload, headers, queryToken } = input;

  let dashfySecret = "";
  let externalToken = "";

  if (integration.webhookSecretEnc) {
    try {
      dashfySecret = decryptSecret(integration.webhookSecretEnc).trim();
    } catch {
      return {
        valid: false,
        reason: "Falha ao descriptografar o segredo da integração no servidor.",
      };
    }
  }

  if (integration.externalTokenEnc) {
    try {
      externalToken = decryptSecret(integration.externalTokenEnc).trim();
    } catch {
      return {
        valid: false,
        reason: "Falha ao descriptografar o token externo da integração.",
      };
    }
  }

  if (integration.authMode === "HMAC_SHA256") {
    const hmacKey = externalToken || dashfySecret;
    if (!hmacKey) {
      return {
        valid: false,
        reason: "Segredo HMAC-SHA256 não configurado para esta integração.",
      };
    }
    const sig = extractIncomingSignature(headers);
    if (!sig) {
      return {
        valid: false,
        reason: "Cabeçalho de assinatura HMAC ausente na requisição.",
      };
    }
    if (!verifyHmacSha256Signature(rawBody, hmacKey, sig)) {
      return {
        valid: false,
        reason: "Assinatura HMAC-SHA256 inválida.",
      };
    }
    return { valid: true };
  }

  if (integration.authMode === "GATEWAY_TOKEN") {
    if (!externalToken) {
      return {
        valid: false,
        reason: "Token fornecido pela ElevyPay ainda não configurado.",
      };
    }
    const incoming = extractIncomingToken(headers, queryToken, payload);
    if (!incoming || !timingSafeStringCompare(incoming, externalToken)) {
      return {
        valid: false,
        reason: "Token de autenticação ElevyPay inválido ou ausente.",
      };
    }
    return { valid: true };
  }

  // Modo padrão: DASHFY_TOKEN (aceita token no header/query/payload OU HMAC-SHA256 assinado com o mesmo segredo)
  if (!dashfySecret) {
    return {
      valid: false,
      reason: "Segredo de webhook da Dashfy não configurado.",
    };
  }

  const incomingSig = extractIncomingSignature(headers);
  if (incomingSig && verifyHmacSha256Signature(rawBody, dashfySecret, incomingSig)) {
    return { valid: true };
  }

  const incomingToken = extractIncomingToken(headers, queryToken, payload);
  if (incomingToken && timingSafeStringCompare(incomingToken, dashfySecret)) {
    return { valid: true };
  }

  return {
    valid: false,
    reason: "Token ou assinatura de autenticação do webhook inválido ou ausente.",
  };
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function parseNumericMoney(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    const cleaned = raw.trim().replace(/[R$\s]/g, "");
    if (!cleaned) return null;
    // Suporta formato pt-BR "1.297,50" e padrão internacional "1297.50"
    const normalized =
      cleaned.includes(",") && cleaned.includes(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.includes(",")
          ? cleaned.replace(",", ".")
          : cleaned;
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * Extrai valores monetários sem inventar taxas ausentes.
 * Suporta campos explícitos em centavos (*_cents) e campos decimais em reais.
 */
export function extractElevyPayAmounts(
  dataObj: Record<string, unknown>,
  payload: Record<string, unknown>
): { grossAmount: number; feeAmount: number; netAmount: number } {
  // 1. Valor bruto
  let grossAmount = 0;
  const rawGrossCents =
    dataObj.amount_cents ??
    dataObj.gross_amount_cents ??
    dataObj.value_cents ??
    payload.amount_cents ??
    payload.gross_amount_cents;

  const parsedGrossCents = parseNumericMoney(rawGrossCents);
  if (parsedGrossCents !== null) {
    grossAmount = roundMoney(Math.max(0, parsedGrossCents / 100));
  } else {
    const rawGross =
      dataObj.amount ??
      dataObj.gross_amount ??
      dataObj.grossAmount ??
      dataObj.total ??
      dataObj.total_amount ??
      dataObj.value ??
      payload.amount ??
      payload.gross_amount ??
      payload.value;
    const parsedGross = parseNumericMoney(rawGross);
    if (parsedGross !== null) {
      grossAmount = roundMoney(Math.max(0, parsedGross));
    }
  }

  // 2. Taxas (NUNCA inventadas — permanece 0 se o gateway não informar)
  let explicitFee: number | null = null;
  const rawFeeCents =
    dataObj.fee_cents ??
    dataObj.fee_amount_cents ??
    payload.fee_cents;

  const parsedFeeCents = parseNumericMoney(rawFeeCents);
  if (parsedFeeCents !== null) {
    explicitFee = roundMoney(Math.max(0, parsedFeeCents / 100));
  } else {
    const rawFee =
      dataObj.fee ??
      dataObj.fee_amount ??
      dataObj.feeAmount ??
      dataObj.gateway_fee ??
      dataObj.tax ??
      payload.fee ??
      payload.fee_amount;
    const parsedFee = parseNumericMoney(rawFee);
    if (parsedFee !== null) {
      explicitFee = roundMoney(Math.max(0, parsedFee));
    }
  }

  // 3. Valor líquido
  let explicitNet: number | null = null;
  const rawNetCents =
    dataObj.net_amount_cents ??
    dataObj.net_cents ??
    payload.net_amount_cents;

  const parsedNetCents = parseNumericMoney(rawNetCents);
  if (parsedNetCents !== null) {
    explicitNet = roundMoney(Math.max(0, parsedNetCents / 100));
  } else {
    const rawNet =
      dataObj.net_amount ??
      dataObj.netAmount ??
      dataObj.net_value ??
      dataObj.liquid_amount ??
      dataObj.received_amount ??
      payload.net_amount ??
      payload.netAmount;
    const parsedNet = parseNumericMoney(rawNet);
    if (parsedNet !== null) {
      explicitNet = roundMoney(Math.max(0, parsedNet));
    }
  }

  let feeAmount = explicitFee ?? 0;
  let netAmount =
    explicitNet !== null
      ? explicitNet
      : roundMoney(Math.max(0, grossAmount - feeAmount));

  // Se o gateway enviou bruto e líquido explicitamente sem enviar campo de taxa, calcula a diferença exata
  if (explicitFee === null && explicitNet !== null && grossAmount > explicitNet) {
    feeAmount = roundMoney(grossAmount - explicitNet);
    netAmount = explicitNet;
  }

  return { grossAmount, feeAmount, netAmount };
}

/**
 * Normaliza status e eventos recebidos para o modelo financeiro da Dashfy:
 * - Pendente -> PENDING (não conta como faturamento realizado)
 * - Aprovado -> COMPLETED
 * - Recusado -> FAILED
 * - Cancelado / Expirado -> CANCELED
 * - Reembolso -> REFUNDED
 * - Chargeback -> CHARGED_BACK
 */
export function normalizeElevyPayStatus(
  rawEvent: string,
  rawStatus: string
): { normalizedStatus: OmegaPayTransactionStatus; canonicalEvent: string } {
  const combined = `${rawEvent} ${rawStatus}`.trim().toUpperCase();

  if (
    combined.includes("CHARGEBACK") ||
    combined.includes("CHARGED_BACK") ||
    combined.includes("DISPUTE") ||
    combined.includes("MED")
  ) {
    return {
      normalizedStatus: "CHARGED_BACK",
      canonicalEvent: rawEvent || "PAYMENT_CHARGED_BACK",
    };
  }

  if (
    combined.includes("REFUND") ||
    combined.includes("ESTORN") ||
    combined.includes("REEMBOLS")
  ) {
    return {
      normalizedStatus: "REFUNDED",
      canonicalEvent: rawEvent || "PAYMENT_REFUNDED",
    };
  }

  if (
    combined.includes("PAID") ||
    combined.includes("APPROVED") ||
    combined.includes("COMPLETED") ||
    combined.includes("CONFIRMED") ||
    combined.includes("SUCCEEDED") ||
    combined.includes("SETTLED") ||
    combined.includes("APROVAD") ||
    combined.includes("PAGO")
  ) {
    return {
      normalizedStatus: "COMPLETED",
      canonicalEvent: rawEvent || "PAYMENT_APPROVED",
    };
  }

  if (
    combined.includes("EXPIRED") ||
    combined.includes("EXPIRAD") ||
    combined.includes("TIMEOUT")
  ) {
    return {
      normalizedStatus: "CANCELED",
      canonicalEvent: rawEvent || "PAYMENT_EXPIRED",
    };
  }

  if (
    combined.includes("CANCEL") ||
    combined.includes("VOID")
  ) {
    return {
      normalizedStatus: "CANCELED",
      canonicalEvent: rawEvent || "PAYMENT_CANCELED",
    };
  }

  if (
    combined.includes("REFUSED") ||
    combined.includes("DECLINED") ||
    combined.includes("REJECTED") ||
    combined.includes("FAILED") ||
    combined.includes("RECUSAD") ||
    combined.includes("NEGAD")
  ) {
    return {
      normalizedStatus: "FAILED",
      canonicalEvent: rawEvent || "PAYMENT_REFUSED",
    };
  }

  return {
    normalizedStatus: "PENDING",
    canonicalEvent: rawEvent || "PAYMENT_PENDING",
  };
}

function normalizePaymentMethod(raw: unknown): string {
  const upper = String(raw || "PIX").trim().toUpperCase();
  if (upper.includes("PIX")) return "PIX";
  if (upper.includes("CART") || upper.includes("CARD") || upper.includes("CREDIT")) {
    return "CREDIT_CARD";
  }
  if (upper.includes("DEBIT")) return "DEBIT_CARD";
  if (upper.includes("BOLETO") || upper.includes("BILLET")) return "BOLETO";
  return upper || "PIX";
}

function extractTrackingMeta(
  dataObj: Record<string, unknown>,
  payload: Record<string, unknown>
): {
  utmSource: string | null;
  utmCampaign: string | null;
  campaignId: string | null;
} {
  const candidates = [
    dataObj.tracking,
    dataObj.trackProps,
    dataObj.utms,
    dataObj.utm,
    dataObj.metadata,
    payload.tracking,
    payload.trackProps,
    payload.utms,
    payload.metadata,
    dataObj,
    payload,
  ].filter(
    (c): c is Record<string, unknown> =>
      Boolean(c) && typeof c === "object" && !Array.isArray(c)
  );

  const pick = (...keys: string[]): string | null => {
    for (const obj of candidates) {
      for (const k of keys) {
        const val = obj[k];
        if (typeof val === "string" && val.trim()) {
          return val.trim().slice(0, 120);
        }
      }
    }
    return null;
  };

  return {
    utmSource: pick("utm_source", "utmSource", "source"),
    utmCampaign: pick("utm_campaign", "utmCampaign", "campaign_name", "campaignName"),
    campaignId: pick("campaign_id", "campaignId", "utm_id"),
  };
}

/**
 * Processa um evento de webhook da ElevyPay já autenticado para um usuário específico.
 * - Sanitiza dados sensíveis e PII antes de gravar logs.
 * - Garante idempotência (evita vendas/notificações duplicadas).
 * - Garante proteção contra eventos recebidos fora de ordem.
 * - Registra histórico auditável de transições de status.
 * - Dispara notificação real de venda aprovada apenas ao entrar em COMPLETED.
 */
export async function processElevyPayWebhook(params: {
  payload: Record<string, unknown>;
  userId: string;
  source?: string;
}): Promise<ProcessElevyPayWebhookResult> {
  const { payload, userId, source = "webhook" } = params;

  try {
    const nestedData =
      payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
        ? (payload.data as Record<string, unknown>)
        : payload.transaction &&
            typeof payload.transaction === "object" &&
            !Array.isArray(payload.transaction)
          ? (payload.transaction as Record<string, unknown>)
          : payload.payment &&
              typeof payload.payment === "object" &&
              !Array.isArray(payload.payment)
            ? (payload.payment as Record<string, unknown>)
            : payload;

    const rawExternalId =
      nestedData.id ??
      nestedData.transaction_id ??
      nestedData.transactionId ??
      nestedData.txid ??
      nestedData.payment_id ??
      nestedData.paymentId ??
      nestedData.order_id ??
      nestedData.orderId ??
      payload.transaction_id ??
      payload.transactionId ??
      payload.txid ??
      payload.payment_id ??
      payload.id;

    if (
      rawExternalId === undefined ||
      rawExternalId === null ||
      !String(rawExternalId).trim()
    ) {
      return {
        ok: false,
        statusCode: 400,
        duplicate: false,
        error: "Identificador da transação ausente no payload ElevyPay.",
      };
    }

    const externalTransactionId = String(rawExternalId).trim().slice(0, 120);
    const scopedTransactionId = buildScopedElevyPayTransactionId(
      userId,
      externalTransactionId
    );

    const rawEvent = String(
      payload.event ??
        payload.event_type ??
        payload.eventType ??
        payload.type ??
        nestedData.event ??
        ""
    ).trim();

    const rawStatus = String(
      nestedData.status ??
        nestedData.payment_status ??
        nestedData.paymentStatus ??
        payload.status ??
        ""
    ).trim();

    const { normalizedStatus, canonicalEvent } = normalizeElevyPayStatus(
      rawEvent,
      rawStatus
    );

    const { grossAmount, feeAmount, netAmount } = extractElevyPayAmounts(
      nestedData,
      payload
    );

    const productObj =
      nestedData.product &&
      typeof nestedData.product === "object" &&
      !Array.isArray(nestedData.product)
        ? (nestedData.product as Record<string, unknown>)
        : null;

    const productName = String(
      productObj?.name ??
        productObj?.title ??
        nestedData.product_name ??
        nestedData.productName ??
        nestedData.description ??
        payload.product_name ??
        payload.description ??
        "Produto ElevyPay"
    )
      .trim()
      .slice(0, 160);

    const productId =
      productObj?.id ?? nestedData.product_id ?? nestedData.productId ?? null;

    const paymentMethod = normalizePaymentMethod(
      nestedData.payment_method ??
        nestedData.paymentMethod ??
        nestedData.method ??
        payload.payment_method ??
        payload.method
    );

    const installmentsRaw = Number(
      nestedData.installments ?? payload.installments ?? 1
    );
    const installments =
      Number.isFinite(installmentsRaw) && installmentsRaw >= 1
        ? Math.round(installmentsRaw)
        : 1;

    const currency = String(
      nestedData.currency ?? payload.currency ?? "BRL"
    )
      .trim()
      .toUpperCase()
      .slice(0, 6);

    const customerObj =
      nestedData.customer &&
      typeof nestedData.customer === "object" &&
      !Array.isArray(nestedData.customer)
        ? (nestedData.customer as Record<string, unknown>)
        : payload.customer &&
            typeof payload.customer === "object" &&
            !Array.isArray(payload.customer)
          ? (payload.customer as Record<string, unknown>)
          : null;

    // Nunca armazenar CPF/documento/telefone em clientIdentifier — apenas nome ou referência segura
    const clientIdentifier =
      typeof customerObj?.name === "string" && customerObj.name.trim()
        ? customerObj.name.trim().slice(0, 100)
        : typeof nestedData.client_identifier === "string" &&
            nestedData.client_identifier.trim()
          ? nestedData.client_identifier.trim().slice(0, 100)
          : null;

    const tracking = extractTrackingMeta(nestedData, payload);

    const createdAtIso = toIsoTimestamp(
      nestedData.created_at ??
        nestedData.createdAt ??
        payload.created_at ??
        payload.timestamp
    );

    const paidAtIso =
      normalizedStatus === "COMPLETED"
        ? toNullableIsoTimestamp(
            nestedData.paid_at ??
              nestedData.paidAt ??
              nestedData.approved_at ??
              payload.paid_at
          ) || new Date().toISOString()
        : null;

    // 1. Idempotência por chave única antes de alterar estado financeiro
    const externalEventId =
      typeof payload.event_id === "string" && payload.event_id.trim()
        ? payload.event_id.trim()
        : typeof payload.eventId === "string" && payload.eventId.trim()
          ? payload.eventId.trim()
          : "";

    const dedupeKey = externalEventId
      ? `elevypay_evt_${externalEventId}`
      : `elevypay_${externalTransactionId}_${normalizedStatus}_${canonicalEvent.toUpperCase()}`;

    const sanitizedPayload = sanitizeData(payload);

    // Consulta transação existente para detectar transição real de status e evitar regressão fora de ordem
    const existingTx = await getTransactionById(userId, scopedTransactionId);
    const statusBefore = existingTx?.status ?? null;
    const resolvedStatus = resolveTransactionStatus(
      canonicalEvent,
      normalizedStatus,
      existingTx?.status
    );

    const webhookResult = await insertWebhookEvent({
      userId,
      gateway: "ELEVYPAY",
      dedupeKey,
      eventType: canonicalEvent,
      entityId: externalTransactionId,
      statusAfter: resolvedStatus,
      sanitizedPayload,
    });

    if (webhookResult.duplicate) {
      safeLog("info", "Webhook ElevyPay duplicado ignorado com idempotência.", {
        externalTransactionId,
        event: canonicalEvent,
      });
      return {
        ok: true,
        statusCode: 200,
        duplicate: true,
        transactionId: scopedTransactionId,
        externalTransactionId,
        statusBefore,
        statusAfter: resolvedStatus,
        eventType: canonicalEvent,
        saleNotificationCreated: false,
      };
    }

    // 2. Persiste ou atualiza transação preservando isolamento por usuário
    const savedTx = await upsertTransaction({
      id: scopedTransactionId,
      userId,
      gateway: "ELEVYPAY",
      clientIdentifier,
      orderId: externalTransactionId,
      productId: productId ? String(productId).slice(0, 100) : null,
      productName,
      offerCode: tracking.campaignId,
      paymentMethod,
      currency,
      grossAmount,
      feeAmount,
      netAmount,
      status: resolvedStatus,
      lastEvent: canonicalEvent,
      installments,
      createdAt: createdAtIso,
      paidAt: resolvedStatus === "COMPLETED" ? paidAtIso : existingTx?.paidAt ?? null,
    });

    // 3. Registra histórico auditável de alteração de status
    if (statusBefore !== savedTx.status) {
      await insertTransactionStatusHistory({
        userId,
        transactionId: savedTx.id,
        gateway: "ELEVYPAY",
        previousStatus: statusBefore,
        newStatus: savedTx.status,
        eventType: canonicalEvent,
        source,
      }).catch(() => {});
    }

    // 4. Atualiza carimbo da última comunicação real na integração
    await touchGatewayIntegrationEvent({
      userId,
      gateway: "ELEVYPAY",
      eventType: canonicalEvent,
      error: null,
    }).catch(() => {});

    // 5. Notificação de venda aprovada (apenas ao transitar/confirmar COMPLETED, idempotente)
    let saleNotificationCreated = false;
    if (savedTx.status === "COMPLETED" && statusBefore !== "COMPLETED") {
      const notifRes = await recordApprovedSaleNotification({
        userId,
        transactionId: savedTx.id,
        dedupeKey: `sale:ELEVYPAY:${userId}:${externalTransactionId}`,
        gateway: "ELEVYPAY",
        productName: savedTx.productName,
        grossAmount: savedTx.grossAmount,
        netAmount: savedTx.netAmount,
        paymentMethod: savedTx.paymentMethod,
        utmSource: tracking.utmSource,
        utmCampaign: tracking.utmCampaign || tracking.campaignId,
      }).catch(() => ({ inserted: false }));
      saleNotificationCreated = Boolean(notifRes.inserted);
    }

    safeLog("info", "Webhook ElevyPay processado com sucesso.", {
      externalTransactionId,
      statusBefore,
      statusAfter: savedTx.status,
      grossAmount: savedTx.grossAmount,
      gateway: "ELEVYPAY",
    });

    return {
      ok: true,
      statusCode: 200,
      duplicate: false,
      transactionId: savedTx.id,
      externalTransactionId,
      statusBefore,
      statusAfter: savedTx.status,
      eventType: canonicalEvent,
      saleNotificationCreated,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    safeLog("error", "Erro ao processar webhook ElevyPay.", {
      errorMessage: message,
    });
    return {
      ok: false,
      statusCode: 500,
      duplicate: false,
      error: "Erro interno ao processar evento da ElevyPay.",
    };
  }
}
