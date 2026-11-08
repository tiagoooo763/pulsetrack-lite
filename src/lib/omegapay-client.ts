import { getServerSetting } from "./db";
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

/**
 * Obtém as credenciais exclusivamente no servidor (Variáveis de Ambiente + fallback seguro no banco).
 * Nunca retorna as chaves em texto aberto para o cliente.
 */
export async function getOmegaPayServerCredentials(): Promise<OmegaPayServerCredentials> {
  const envPublicKey = process.env.OMEGAPAY_PUBLIC_KEY?.trim() || "";
  const envSecretKey = process.env.OMEGAPAY_SECRET_KEY?.trim() || "";
  const envWebhookToken = process.env.OMEGAPAY_WEBHOOK_TOKEN?.trim() || "";
  const envBaseUrl = process.env.OMEGAPAY_API_BASE_URL?.trim() || "";

  const dbPublicKey = (await getServerSetting("OMEGAPAY_PUBLIC_KEY"))?.trim() || "";
  const dbSecretKey = (await getServerSetting("OMEGAPAY_SECRET_KEY"))?.trim() || "";
  const dbWebhookToken = (await getServerSetting("OMEGAPAY_WEBHOOK_TOKEN"))?.trim() || "";

  const publicKey = envPublicKey || dbPublicKey;
  const secretKey = envSecretKey || dbSecretKey;
  const webhookToken = [envWebhookToken, dbWebhookToken]
    .filter(Boolean)
    .join(",");
  const baseUrl = (envBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");

  let source: "env" | "db" | "mixed" | "none" = "none";
  if ((envPublicKey || envSecretKey || envWebhookToken) && (dbPublicKey || dbSecretKey || dbWebhookToken)) {
    source = "mixed";
  } else if (envPublicKey || envSecretKey || envWebhookToken) {
    source = "env";
  } else if (dbPublicKey || dbSecretKey || dbWebhookToken) {
    source = "db";
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

/**
 * Executa apenas chamadas GET de leitura nos endpoints oficiais da OmegaPay.
 * Nenhuma operação financeira de escrita (saques, transferências, etc.) é implementada.
 */
async function omegaPayGet<T>(
  apiPath: string,
  queryParams?: Record<string, string | undefined>
): Promise<T> {
  const creds = await getOmegaPayServerCredentials();
  if (!creds.hasApiCredentials) {
    throw new OmegaPayApiError(
      "Credenciais da API OmegaPay (x-public-key e x-secret-key) não configuradas no servidor.",
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

/**
 * 1. Meu saldo — GET /gateway/producer/balance
 * Documentação: https://app.omegapayments.com.br/docs/v1/endpoint/producer/balance
 * Retorno oficial: { available: number, pending: number, fundLock: number }
 */
export async function fetchOmegaPayBalance(): Promise<OmegaPayBalanceResponse> {
  const data = await omegaPayGet<OmegaPayBalanceResponse>(
    "/gateway/producer/balance"
  );
  return {
    available: Number(data.available ?? 0),
    pending: Number(data.pending ?? 0),
    fundLock: Number(data.fundLock ?? 0),
  };
}

/**
 * 2. Testar credenciais — GET /gateway/producer/credentials
 * Documentação: https://app.omegapayments.com.br/docs/v1/endpoint/producer/credentials
 * Retorno oficial: { name: string, permissions: string[], grantAllPermissions: boolean, expiresAt: string | null }
 */
export async function testOmegaPayCredentials(): Promise<OmegaPayCredentialsResponse> {
  const data = await omegaPayGet<OmegaPayCredentialsResponse>(
    "/gateway/producer/credentials"
  );
  return {
    name: String(data.name ?? "Credencial OmegaPay"),
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
    grantAllPermissions: Boolean(data.grantAllPermissions),
    expiresAt: data.expiresAt ?? null,
  };
}

/**
 * 3. Buscar transação — GET /gateway/transactions
 * Documentação: https://app.omegapayments.com.br/docs/v1/endpoint/transactions
 * Query params oficiais: id (opcional), clientIdentifier (opcional)
 * Aviso oficial: Não realizar polling frequente; usar apenas para consultas pontuais.
 */
export async function fetchOmegaPayTransaction(params: {
  id?: string;
  clientIdentifier?: string;
}): Promise<OmegaPayTransactionLookupResponse> {
  if (!params.id?.trim() && !params.clientIdentifier?.trim()) {
    throw new OmegaPayApiError(
      "Informe o ID da transação (id) ou o identificador do cliente (clientIdentifier).",
      400,
      "MISSING_QUERY_PARAM"
    );
  }

  return omegaPayGet<OmegaPayTransactionLookupResponse>(
    "/gateway/transactions",
    {
      id: params.id,
      clientIdentifier: params.clientIdentifier,
    }
  );
}

/**
 * 4. Buscar transferência — GET /gateway/transfers
 * Documentação: https://app.omegapayments.com.br/docs/v1/endpoint/transfers-search
 * Query params oficiais: id (opcional), clientIdentifier (opcional)
 * Aviso oficial: Requer permissão P_THIRD_PARTY_WITHDRAW ativa na conta; não usar para polling frequente.
 */
export async function fetchOmegaPayTransfer(params: {
  id?: string;
  clientIdentifier?: string;
}): Promise<OmegaPayTransferLookupResponse> {
  if (!params.id?.trim() && !params.clientIdentifier?.trim()) {
    throw new OmegaPayApiError(
      "Informe o ID da transferência (id) ou o identificador do cliente (clientIdentifier).",
      400,
      "MISSING_QUERY_PARAM"
    );
  }

  return omegaPayGet<OmegaPayTransferLookupResponse>("/gateway/transfers", {
    id: params.id,
    clientIdentifier: params.clientIdentifier,
  });
}
