import {
  getUserProfile,
  getUserSettingsBatch,
  LEGACY_ADMIN_USER_ID,
} from "./db";
import {
  type OmegaPayBalanceResponse,
  type OmegaPayCredentialsResponse,
  type OmegaPayErrorResponse,
  type OmegaPayTransactionLookupResponse,
  type OmegaPayTransferLookupResponse,
} from "./omegapay-types";
import { safeLog } from "./sanitize";

const DEFAULT_BASE_URL = "https://app.omegapayments.com.br/api/v1";

export interface OmegaPayServerCredentials {
  baseUrl: string;
  publicKey: string;
  secretKey: string;
  webhookToken: string;
  hasApiCredentials: boolean;
  hasWebhookToken: boolean;
  source: "env" | "db" | "mixed" | "none";
}

async function isLegacyOwnerAccount(userId: string): Promise<boolean> {
  if (userId === LEGACY_ADMIN_USER_ID) return true;
  const ownerEmail = (
    process.env.DASHBOARD_USER?.trim() || "mendoncat831@gmail.com"
  ).toLowerCase();
  const profile = await getUserProfile(userId);
  return Boolean(profile && profile.email.trim().toLowerCase() === ownerEmail);
}

/**
 * Obtém credenciais OmegaPay isoladas por usuário exclusivamente no servidor.
 * Variáveis de ambiente globais aplicam-se APENAS à conta proprietária legada,
 * garantindo que novos usuários nunca herdem chaves de terceiros.
 */
export async function getOmegaPayServerCredentials(
  userId: string = LEGACY_ADMIN_USER_ID,
  preloadedSettings?: Record<string, string>,
  preloadedUserEmail?: string
): Promise<OmegaPayServerCredentials> {
  const ownerEmail = (
    process.env.DASHBOARD_USER?.trim() || "mendoncat831@gmail.com"
  ).toLowerCase();
  const allowEnvFallback =
    userId === LEGACY_ADMIN_USER_ID ||
    (preloadedUserEmail
      ? preloadedUserEmail.trim().toLowerCase() === ownerEmail
      : await isLegacyOwnerAccount(userId));

  const envPublicKey = allowEnvFallback
    ? process.env.OMEGAPAY_PUBLIC_KEY?.trim() || ""
    : "";
  const envSecretKey = allowEnvFallback
    ? process.env.OMEGAPAY_SECRET_KEY?.trim() || ""
    : "";
  const envWebhookToken = allowEnvFallback
    ? process.env.OMEGAPAY_WEBHOOK_TOKEN?.trim() || ""
    : "";
  const envBaseUrl = process.env.OMEGAPAY_API_BASE_URL?.trim() || "";

  const settings = preloadedSettings ?? (await getUserSettingsBatch(userId));
  const dbPublicKey = settings["OMEGAPAY_PUBLIC_KEY"]?.trim() || "";
  const dbSecretKey = settings["OMEGAPAY_SECRET_KEY"]?.trim() || "";
  const dbWebhookToken = settings["OMEGAPAY_WEBHOOK_TOKEN"]?.trim() || "";

  const publicKey = dbPublicKey || envPublicKey;
  const secretKey = dbSecretKey || envSecretKey;
  const webhookToken = [dbWebhookToken, envWebhookToken]
    .filter(Boolean)
    .join(",");
  const baseUrl = (envBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");

  let source: "env" | "db" | "mixed" | "none" = "none";
  if (
    (envPublicKey || envSecretKey || envWebhookToken) &&
    (dbPublicKey || dbSecretKey || dbWebhookToken)
  ) {
    source = "mixed";
  } else if (dbPublicKey || dbSecretKey || dbWebhookToken) {
    source = "db";
  } else if (envPublicKey || envSecretKey || envWebhookToken) {
    source = "env";
  }

  return {
    baseUrl,
    publicKey,
    secretKey,
    webhookToken,
    hasApiCredentials: Boolean(publicKey && secretKey),
    hasWebhookToken: Boolean(webhookToken),
    source,
  };
}

export class OmegaPayApiError extends Error {
  statusCode: number;
  errorCode: string;

  constructor(message: string, statusCode = 500, errorCode = "OMEGAPAY_ERROR") {
    super(message);
    this.name = "OmegaPayApiError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

async function omegaPayGet<T>(
  apiPath: string,
  userId: string = LEGACY_ADMIN_USER_ID,
  queryParams?: Record<string, string | undefined>
): Promise<T> {
  const creds = await getOmegaPayServerCredentials(userId);
  if (!creds.hasApiCredentials) {
    throw new OmegaPayApiError(
      "Credenciais da API OmegaPay (x-public-key e x-secret-key) não configuradas para esta conta.",
      401,
      "MISSING_CREDENTIALS"
    );
  }

  const url = new URL(`${creds.baseUrl}${apiPath}`);
  if (queryParams) {
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v.trim() !== "") {
        url.searchParams.set(k, v.trim());
      }
    }
  }

  safeLog("info", `Consultando endpoint oficial OmegaPay GET ${apiPath}`, {
    queryKeys: queryParams ? Object.keys(queryParams) : [],
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "x-public-key": creds.publicKey,
      "x-secret-key": creds.secretKey,
    },
    cache: "no-store",
  });

  const rawText = await response.text();
  let parsed: unknown = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new OmegaPayApiError(
      `Resposta não-JSON recebida da OmegaPay (HTTP ${response.status}). Verifique se o IP do servidor não está bloqueado por geolocalização.`,
      response.status,
      "NON_JSON_RESPONSE"
    );
  }

  if (!response.ok) {
    const errObj = (parsed || {}) as OmegaPayErrorResponse;
    const message =
      errObj.message ||
      (typeof errObj.error === "string"
        ? errObj.error
        : errObj.error?.message) ||
      `Erro HTTP ${response.status} ao consultar OmegaPay`;
    const errorCode =
      errObj.errorCode ||
      (typeof errObj.error === "object" ? errObj.error?.errorCode : undefined) ||
      `HTTP_${response.status}`;

    throw new OmegaPayApiError(message, response.status, errorCode);
  }

  return parsed as T;
}

export async function fetchOmegaPayBalance(
  userId: string = LEGACY_ADMIN_USER_ID
): Promise<OmegaPayBalanceResponse> {
  const data = await omegaPayGet<OmegaPayBalanceResponse>(
    "/gateway/producer/balance",
    userId
  );
  return {
    available: Number(data.available ?? 0),
    pending: Number(data.pending ?? 0),
    fundLock: Number(data.fundLock ?? 0),
  };
}

export async function testOmegaPayCredentials(
  userId: string = LEGACY_ADMIN_USER_ID
): Promise<OmegaPayCredentialsResponse> {
  const data = await omegaPayGet<OmegaPayCredentialsResponse>(
    "/gateway/producer/credentials",
    userId
  );
  return {
    name: String(data.name ?? "Credencial OmegaPay"),
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
    grantAllPermissions: Boolean(data.grantAllPermissions),
    expiresAt: data.expiresAt ?? null,
  };
}

export async function fetchOmegaPayTransaction(
  params: { id?: string; clientIdentifier?: string },
  userId: string = LEGACY_ADMIN_USER_ID
): Promise<OmegaPayTransactionLookupResponse> {
  if (!params.id?.trim() && !params.clientIdentifier?.trim()) {
    throw new OmegaPayApiError(
      "Informe o ID da transação (id) ou o identificador do cliente (clientIdentifier).",
      400,
      "MISSING_QUERY_PARAM"
    );
  }

  return omegaPayGet<OmegaPayTransactionLookupResponse>(
    "/gateway/transactions",
    userId,
    {
      id: params.id,
      clientIdentifier: params.clientIdentifier,
    }
  );
}

export async function fetchOmegaPayTransfer(
  params: { id?: string; clientIdentifier?: string },
  userId: string = LEGACY_ADMIN_USER_ID
): Promise<OmegaPayTransferLookupResponse> {
  if (!params.id?.trim() && !params.clientIdentifier?.trim()) {
    throw new OmegaPayApiError(
      "Informe o ID da transferência (id) ou o identificador do cliente (clientIdentifier).",
      400,
      "MISSING_QUERY_PARAM"
    );
  }

  return omegaPayGet<OmegaPayTransferLookupResponse>(
    "/gateway/transfers",
    userId,
    {
      id: params.id,
      clientIdentifier: params.clientIdentifier,
    }
  );
}
