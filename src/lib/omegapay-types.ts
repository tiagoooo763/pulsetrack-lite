/**
 * Tipagens oficiais da API e Webhooks da OmegaPay (v1)
 * Documentação: https://app.omegapayments.com.br/docs/v1/webhooks
 * Base URL: https://app.omegapayments.com.br/api/v1
 */

// 1. Identificadores exatos dos eventos de Webhook da OmegaPay v1
export const OMEGAPAY_TRANSACTION_EVENTS = [
  "TRANSACTION_CREATED",
  "TRANSACTION_PAID",
  "TRANSACTION_CANCELED",
  "TRANSACTION_REFUNDED",
  "TRANSACTION_CHARGED_BACK",
] as const;

export const OMEGAPAY_TRANSFER_EVENTS = [
  "TRANSFER_CREATED",
  "TRANSFER_COMPLETED",
  "TRANSFER_FAILED",
] as const;

export const OMEGAPAY_CHARGEBACK_EVENTS = [
  "CHARGEBACK_CREATED",
  "MED_CREATED",
  "CHARGEBACK_UPDATED",
  "MED_UPDATED",
] as const;

export const OMEGAPAY_SUBSCRIPTION_EVENTS = [
  "SUBSCRIPTION_TRIAL_STARTED",
  "SUBSCRIPTION_STARTED",
  "SUBSCRIPTION_RENEWAL_PENDING",
  "SUBSCRIPTION_RENEWED",
  "SUBSCRIPTION_EXPIRED",
  "SUBSCRIPTION_CANCELED",
] as const;

export const OMEGAPAY_SESSION_EVENTS = [
  "SESSION_CREATED",
  "SESSION_UPDATED",
  "SESSION_CLIENT_UPDATED",
  "SESSION_ABANDONED",
] as const;

export const ALL_OMEGAPAY_WEBHOOK_EVENTS = [
  ...OMEGAPAY_TRANSACTION_EVENTS,
  ...OMEGAPAY_TRANSFER_EVENTS,
  ...OMEGAPAY_CHARGEBACK_EVENTS,
  ...OMEGAPAY_SUBSCRIPTION_EVENTS,
  ...OMEGAPAY_SESSION_EVENTS,
] as const;

export type OmegaPayTransactionEvent = (typeof OMEGAPAY_TRANSACTION_EVENTS)[number];
export type OmegaPayTransferEvent = (typeof OMEGAPAY_TRANSFER_EVENTS)[number];
export type OmegaPayChargebackEvent = (typeof OMEGAPAY_CHARGEBACK_EVENTS)[number];
export type OmegaPaySubscriptionEvent = (typeof OMEGAPAY_SUBSCRIPTION_EVENTS)[number];
export type OmegaPaySessionEvent = (typeof OMEGAPAY_SESSION_EVENTS)[number];
export type OmegaPayWebhookEvent = (typeof ALL_OMEGAPAY_WEBHOOK_EVENTS)[number];

export type OmegaPayTransactionStatus =
  | "COMPLETED"
  | "FAILED"
  | "PENDING"
  | "REFUNDED"
  | "CHARGED_BACK"
  | "CANCELED";

export type OmegaPayPaymentMethod =
  | "CREDIT_CARD"
  | "PIX"
  | "BOLETO"
  | "CRYPTO"
  | string;

export type OmegaPayTransferStatus =
  | "PENDING"
  | "PROCESSING"
  | "TRANSFERRING"
  | "COMPLETED"
  | "CANCELED"
  | "FAILED";

export interface OmegaPayWebhookFee {
  currency: string;
  amount: number;
  description: string | null;
  type: "FUND_LOCK" | "OPERATION" | "ACQUIRER" | "CUSTOM" | string;
}

export interface OmegaPayOrderItem {
  id: string;
  price: number;
  product: {
    id: string;
    name: string;
    externalId?: string | null;
  };
}

export interface OmegaPayWebhookTransactionPayload {
  event: OmegaPayTransactionEvent;
  token: string;
  offerCode?: string | null;
  checkoutUrl?: string;
  orderId?: string | null;
  orderUrl?: string | null;
  fees?: OmegaPayWebhookFee[];
  client?: {
    id?: string;
    name?: string;
    email?: string;
    // Campos sensíveis omitidos de logs/persistência: phone, cpf, cnpj, address
    [key: string]: unknown;
  } | null;
  transaction: {
    id: string;
    identifier?: string | null;
    status: OmegaPayTransactionStatus;
    paymentMethod: OmegaPayPaymentMethod;
    originalAmount?: number;
    originalCurrency?: string;
    amount: number;
    chargeAmount?: number;
    commissionAmount?: number;
    currency?: string;
    exchangeRate?: number | null;
    installments?: number;
    createdAt?: string;
    createAt?: string; // Alguns exemplos da doc usam createAt
    payedAt?: string | null;
    orderItems?: OmegaPayOrderItem[];
    [key: string]: unknown;
  };
  orderItems?: OmegaPayOrderItem[];
  subscription?: {
    id: string;
    identifier?: string | null;
    cycle?: number;
    startAt?: string;
    intervalType?: "DAYS" | "WEEKS" | "MONTHS" | "YEARS";
    intervalCount?: number;
    status?: "ACTIVE" | "INACTIVE" | "CANCELED";
  } | null;
  trackProps?: Record<string, unknown>;
}

export interface OmegaPayWebhookTransferPayload {
  event: OmegaPayTransferEvent;
  token: string;
  withdraw: {
    id: string;
    clientIdentifier?: string | null;
    amount: number;
    message?: string | null;
    receivedAmount: number;
    feeAmount: number;
    currency: string;
    status: OmegaPayTransferStatus;
    createdAt: string;
    updatedAt: string;
  };
  sents?: Array<{
    id: string;
    amount: number;
    status: "PROCESSING" | "COMPLETED" | "FAILED";
    endToEndId?: string | null;
    createdAt: string;
  }>;
  [key: string]: unknown;
}

// =======================================================
// Respostas Oficiais dos Endpoints REST GET da OmegaPay
// =======================================================

/**
 * 1. Meu saldo — GET /api/v1/gateway/producer/balance
 */
export interface OmegaPayBalanceResponse {
  available: number; // Saldo disponível para saque
  pending: number;   // Saldo pendente
  fundLock: number;  // Saldo retido (garantia/retenção)
}

/**
 * 2. Testar credenciais — GET /api/v1/gateway/producer/credentials
 */
export interface OmegaPayCredentialsResponse {
  name: string;
  permissions: string[];
  grantAllPermissions: boolean;
  expiresAt: string | null;
}

/**
 * 3. Buscar transação — GET /api/v1/gateway/transactions
 * Query params: ?id=... ou ?clientIdentifier=...
 */
export interface OmegaPayTransactionLookupResponse {
  id: string;
  clientIdentifier: string | null;
  currency: string;
  amount: number;
  chargeAmount: number;
  exchangeRate: number;
  producerExtraAmount: number;
  status: string;
  statusDescription: string | null;
  purchaseType: "ONCE" | "RECURRING" | string;
  paymentMethod: string;
  details: string | null;
  errorDescription: string | null;
  webhookUrl: string | null;
  createdAt: string;
  availableAt: string;
  payedAt: string | null;
  refundedAt: string | null;
}

/**
 * 4. Buscar transferência — GET /api/v1/gateway/transfers
 * Query params: ?id=... ou ?clientIdentifier=...
 */
export interface OmegaPayTransferLookupResponse {
  id: string;
  clientIdentifier: string | null;
  amount: number;
  currency: string;
  status: OmegaPayTransferStatus;
  rejectedReason?: string | null;
  withdrawSent?: Array<{
    id: string;
    amount: number;
    status: string;
    message: string | null;
    endToEndId: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface OmegaPayErrorResponse {
  statusCode?: number;
  errorCode?: string;
  message?: string;
  error?: string | { message?: string; statusCode?: number; errorCode?: string };
}
