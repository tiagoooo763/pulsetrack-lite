import { safeLog } from "./sanitize";
import type {
  TikTokAdvertiserSummary,
  TikTokBusinessCenterSummary,
} from "./db";

/**
 * Cliente oficial somente-leitura para a TikTok Marketing API (OAuth 2.0 + v1.3).
 * - Nunca expõe App Secret, access_token ou auth_code em logs ou no frontend.
 * - Implementa APENAS operações de autorização e leitura/relatórios (zero escrita em anúncios).
 */

export const DEFAULT_TIKTOK_CALLBACK_URL =
  "https://www.usedashfy.com.br/api/integrations/tiktok/callback";

const TIKTOK_AUTH_PORTAL_URL = "https://business-api.tiktok.com/portal/auth";
const TIKTOK_API_BASE_URL = "https://business-api.tiktok.com/open_api/v1.3";

export type TikTokErrorCategory =
  | "CONFIG_MISSING"
  | "INVALID_AUTH_CODE"
  | "INVALID_TOKEN"
  | "NO_PERMISSION"
  | "UNAVAILABLE_ACCOUNT"
  | "API_ERROR";

export class TikTokApiError extends Error {
  readonly code: number;
  readonly httpStatus: number;
  readonly category: TikTokErrorCategory;

  constructor(
    message: string,
    options: {
      code?: number;
      httpStatus?: number;
      category?: TikTokErrorCategory;
    } = {}
  ) {
    super(message);
    this.name = "TikTokApiError";
    this.code = options.code ?? -1;
    this.httpStatus = options.httpStatus ?? 502;
    this.category = options.category ?? "API_ERROR";
  }
}

export interface TikTokServerConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
  isConfigured: boolean;
}

export function getTikTokOAuthConfig(): TikTokServerConfig {
  const appId = process.env.TIKTOK_APP_ID?.trim() || "";
  const appSecret = process.env.TIKTOK_APP_SECRET?.trim() || "";
  const redirectUri =
    process.env.TIKTOK_REDIRECT_URI?.trim() || DEFAULT_TIKTOK_CALLBACK_URL;

  return {
    appId,
    appSecret,
    redirectUri,
    isConfigured: Boolean(appId && appSecret),
  };
}

/**
 * Monta a URL oficial de autorização do TikTok for Business Marketing API.
 */
export function buildTikTokAuthorizeUrl(params: {
  state: string;
  redirectUri?: string;
}): string {
  const cfg = getTikTokOAuthConfig();
  if (!cfg.isConfigured) {
    throw new TikTokApiError(
      "Credenciais do aplicativo TikTok (TIKTOK_APP_ID e TIKTOK_APP_SECRET) ainda não foram configuradas no servidor.",
      { httpStatus: 503, category: "CONFIG_MISSING" }
    );
  }

  const url = new URL(TIKTOK_AUTH_PORTAL_URL);
  url.searchParams.set("app_id", cfg.appId);
  url.searchParams.set("state", params.state);
  url.searchParams.set("redirect_uri", params.redirectUri || cfg.redirectUri);
  return url.toString();
}

export function classifyTikTokError(
  apiCode: number,
  apiMessage: string
): TikTokApiError {
  const lower = (apiMessage || "").toLowerCase();

  if (
    apiCode === 40105 ||
    apiCode === 40104 ||
    apiCode === 40001 ||
    lower.includes("access token") ||
    lower.includes("token is invalid") ||
    lower.includes("token expired")
  ) {
    return new TikTokApiError(
      "Token de acesso do TikTok inválido ou expirado. Reconecte sua conta TikTok Business.",
      { code: apiCode, httpStatus: 401, category: "INVALID_TOKEN" }
    );
  }

  if (
    apiCode === 40002 ||
    apiCode === 40007 ||
    apiCode === 40300 ||
    lower.includes("permission") ||
    lower.includes("scope") ||
    lower.includes("not authorized")
  ) {
    return new TikTokApiError(
      "Permissão insuficiente no TikTok para consultar este recurso. Verifique os escopos concedidos na autorização.",
      { code: apiCode, httpStatus: 403, category: "NO_PERMISSION" }
    );
  }

  if (
    apiCode === 40003 ||
    apiCode === 40004 ||
    apiCode === 40100 ||
    apiCode === 40101 ||
    lower.includes("auth_code") ||
    lower.includes("auth code")
  ) {
    return new TikTokApiError(
      "Código de autorização (auth_code) expirado ou já utilizado. Inicie a conexão com o TikTok novamente.",
      { code: apiCode, httpStatus: 400, category: "INVALID_AUTH_CODE" }
    );
  }

  if (
    apiCode === 40008 ||
    apiCode === 40009 ||
    apiCode === 40102 ||
    lower.includes("advertiser") &&
      (lower.includes("not found") ||
        lower.includes("invalid") ||
        lower.includes("unavailable") ||
        lower.includes("frozen"))
  ) {
    return new TikTokApiError(
      "Conta de anúncios indisponível ou não autorizada para esta conexão.",
      { code: apiCode, httpStatus: 404, category: "UNAVAILABLE_ACCOUNT" }
    );
  }

  return new TikTokApiError(
    apiMessage
      ? `Erro retornado pela TikTok Marketing API (código ${apiCode}): ${apiMessage}`
      : `Falha na comunicação com a TikTok Marketing API (código ${apiCode}).`,
    { code: apiCode, httpStatus: 502, category: "API_ERROR" }
  );
}

interface TikTokEnvelope<T> {
  code?: number;
  message?: string;
  data?: T;
}

async function parseTikTokJson<T>(res: Response): Promise<T> {
  let json: TikTokEnvelope<T>;
  try {
    json = (await res.json()) as TikTokEnvelope<T>;
  } catch {
    throw new TikTokApiError(
      "Resposta inválida recebida da TikTok Marketing API.",
      { httpStatus: res.status || 502, category: "API_ERROR" }
    );
  }

  const apiCode = typeof json.code === "number" ? json.code : -1;
  if (!res.ok || apiCode !== 0) {
    throw classifyTikTokError(apiCode, String(json.message || ""));
  }

  return (json.data ?? {}) as T;
}

export interface TikTokTokenExchangeResult {
  accessToken: string;
  advertiserIds: string[];
  scope: string[];
}

/**
 * Troca o `auth_code` recebido no callback pelo `access_token` oficial do anunciante.
 * Endpoint oficial: POST /open_api/v1.3/oauth2/access_token/
 */
export async function exchangeTikTokAuthCode(
  authCode: string,
  fetchImpl: typeof fetch = fetch
): Promise<TikTokTokenExchangeResult> {
  const cfg = getTikTokOAuthConfig();
  if (!cfg.isConfigured) {
    throw new TikTokApiError(
      "Credenciais do aplicativo TikTok não configuradas no servidor.",
      { httpStatus: 503, category: "CONFIG_MISSING" }
    );
  }

  const trimmedCode = authCode.trim();
  if (!trimmedCode) {
    throw new TikTokApiError("Código de autorização (auth_code) ausente.", {
      httpStatus: 400,
      category: "INVALID_AUTH_CODE",
    });
  }

  const res = await fetchImpl(`${TIKTOK_API_BASE_URL}/oauth2/access_token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_id: cfg.appId,
      secret: cfg.appSecret,
      auth_code: trimmedCode,
    }),
    cache: "no-store",
  });

  const data = await parseTikTokJson<{
    access_token?: string;
    advertiser_ids?: Array<string | number>;
    scope?: Array<string | number> | string;
  }>(res);

  if (!data.access_token) {
    throw new TikTokApiError(
      "A TikTok Marketing API não retornou um token de acesso válido.",
      { httpStatus: 502, category: "INVALID_TOKEN" }
    );
  }

  const advertiserIds = Array.isArray(data.advertiser_ids)
    ? data.advertiser_ids.map((id) => String(id)).filter(Boolean)
    : [];

  const scope = Array.isArray(data.scope)
    ? data.scope.map((s) => String(s))
    : typeof data.scope === "string"
      ? data.scope
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  safeLog("info", "Troca de auth_code TikTok concluída com sucesso.", {
    advertiserCount: advertiserIds.length,
    scopeCount: scope.length,
  });

  return {
    accessToken: data.access_token,
    advertiserIds,
    scope,
  };
}

/**
 * Consulta somente-leitura das contas de anúncios autorizadas pelo usuário.
 * Endpoint oficial: GET /open_api/v1.3/oauth2/advertiser/get/
 */
export async function fetchAuthorizedTikTokAdvertisers(
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<TikTokAdvertiserSummary[]> {
  const cfg = getTikTokOAuthConfig();
  if (!cfg.isConfigured) {
    throw new TikTokApiError(
      "Credenciais do aplicativo TikTok não configuradas no servidor.",
      { httpStatus: 503, category: "CONFIG_MISSING" }
    );
  }

  const url = new URL(`${TIKTOK_API_BASE_URL}/oauth2/advertiser/get/`);
  url.searchParams.set("app_id", cfg.appId);
  url.searchParams.set("secret", cfg.appSecret);

  const res = await fetchImpl(url.toString(), {
    method: "GET",
    headers: {
      "Access-Token": accessToken,
    },
    cache: "no-store",
  });

  const data = await parseTikTokJson<{
    list?: Array<{
      advertiser_id?: string | number;
      advertiser_name?: string;
    }>;
  }>(res);

  const list = Array.isArray(data.list) ? data.list : [];
  return list
    .map((item) => ({
      advertiserId: String(item.advertiser_id ?? "").trim(),
      advertiserName: String(item.advertiser_name ?? "").trim() || "Conta TikTok Ads",
    }))
    .filter((a) => Boolean(a.advertiserId));
}

/**
 * Consulta somente-leitura dos Business Centers autorizados pelo usuário.
 * Endpoint oficial: GET /open_api/v1.3/bc/get/
 * Se o escopo de Business Center não tiver sido concedido, retorna lista vazia sem quebrar o fluxo.
 */
export async function fetchAuthorizedTikTokBusinessCenters(
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<{
  businessCenters: TikTokBusinessCenterSummary[];
  permissionWarning?: string;
}> {
  try {
    const url = new URL(`${TIKTOK_API_BASE_URL}/bc/get/`);
    url.searchParams.set("page", "1");
    url.searchParams.set("page_size", "50");

    const res = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        "Access-Token": accessToken,
      },
      cache: "no-store",
    });

    const data = await parseTikTokJson<{
      list?: Array<{
        bc_info?: {
          bc_id?: string | number;
          name?: string;
          currency?: string;
          status?: string;
        };
        user_role?: string;
      }>;
    }>(res);

    const list = Array.isArray(data.list) ? data.list : [];
    const businessCenters: TikTokBusinessCenterSummary[] = list
      .map((item) => {
        const info = item.bc_info || {};
        return {
          bcId: String(info.bc_id ?? "").trim(),
          name: String(info.name ?? "").trim() || "Business Center",
          currency: info.currency ? String(info.currency) : undefined,
          status: info.status ? String(info.status) : undefined,
          role: item.user_role ? String(item.user_role) : undefined,
        };
      })
      .filter((bc) => Boolean(bc.bcId));

    return { businessCenters };
  } catch (err) {
    if (err instanceof TikTokApiError && err.category === "NO_PERMISSION") {
      return {
        businessCenters: [],
        permissionWarning:
          "Escopo de leitura de Business Center não autorizado nesta conta; exibindo apenas contas de anúncios autorizadas.",
      };
    }
    if (err instanceof TikTokApiError && err.category === "INVALID_TOKEN") {
      throw err;
    }
    safeLog("warn", "Não foi possível listar Business Centers do TikTok.", {
      reason: err instanceof Error ? err.message : "unknown",
    });
    return { businessCenters: [] };
  }
}

export interface TikTokReadOnlyReportRow {
  statDate: string;
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  conversions: number;
}

export interface TikTokReadOnlyReportResult {
  advertiserId: string;
  startDate: string;
  endDate: string;
  totals: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    cpc: number;
    cpm: number;
  };
  rows: TikTokReadOnlyReportRow[];
}

/**
 * Consulta SOMENTE-LEITURA de gastos e relatórios de campanhas no TikTok Ads.
 * Endpoint oficial: GET /open_api/v1.3/report/integrated/get/
 * NÃO cria, edita nem exclui campanhas ou anúncios.
 */
export async function fetchTikTokReadOnlyReport(
  params: {
    accessToken: string;
    advertiserId: string;
    startDate: string;
    endDate: string;
  },
  fetchImpl: typeof fetch = fetch
): Promise<TikTokReadOnlyReportResult> {
  const url = new URL(`${TIKTOK_API_BASE_URL}/report/integrated/get/`);
  url.searchParams.set("advertiser_id", params.advertiserId);
  url.searchParams.set("report_type", "BASIC");
  url.searchParams.set("data_level", "AUCTION_CAMPAIGN");
  url.searchParams.set(
    "dimensions",
    JSON.stringify(["campaign_id", "stat_time_day"])
  );
  url.searchParams.set(
    "metrics",
    JSON.stringify([
      "campaign_name",
      "spend",
      "impressions",
      "clicks",
      "cpc",
      "cpm",
      "conversion",
    ])
  );
  url.searchParams.set("start_date", params.startDate);
  url.searchParams.set("end_date", params.endDate);
  url.searchParams.set("page", "1");
  url.searchParams.set("page_size", "100");

  const res = await fetchImpl(url.toString(), {
    method: "GET",
    headers: {
      "Access-Token": params.accessToken,
    },
    cache: "no-store",
  });

  const data = await parseTikTokJson<{
    list?: Array<{
      dimensions?: {
        campaign_id?: string | number;
        stat_time_day?: string;
      };
      metrics?: {
        campaign_name?: string;
        spend?: string | number;
        impressions?: string | number;
        clicks?: string | number;
        cpc?: string | number;
        cpm?: string | number;
        conversion?: string | number;
      };
    }>;
  }>(res);

  const list = Array.isArray(data.list) ? data.list : [];
  const rows: TikTokReadOnlyReportRow[] = list.map((item) => {
    const dim = item.dimensions || {};
    const m = item.metrics || {};
    const spend = Number(m.spend || 0);
    const impressions = Math.round(Number(m.impressions || 0));
    const clicks = Math.round(Number(m.clicks || 0));
    const conversions = Math.round(Number(m.conversion || 0));
    const cpc = Number(m.cpc || (clicks > 0 ? spend / clicks : 0));
    const cpm = Number(
      m.cpm || (impressions > 0 ? (spend / impressions) * 1000 : 0)
    );
    const rawDate = String(dim.stat_time_day || params.endDate).slice(0, 10);

    return {
      statDate: rawDate,
      campaignId: String(dim.campaign_id || ""),
      campaignName:
        String(m.campaign_name || "").trim() ||
        `Campanha ${dim.campaign_id || ""}`.trim(),
      spend: Number.isFinite(spend) ? spend : 0,
      impressions: Number.isFinite(impressions) ? impressions : 0,
      clicks: Number.isFinite(clicks) ? clicks : 0,
      cpc: Number.isFinite(cpc) ? cpc : 0,
      cpm: Number.isFinite(cpm) ? cpm : 0,
      conversions: Number.isFinite(conversions) ? conversions : 0,
    };
  });

  const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalConversions = rows.reduce((s, r) => s + r.conversions, 0);

  return {
    advertiserId: params.advertiserId,
    startDate: params.startDate,
    endDate: params.endDate,
    totals: {
      spend: Number(totalSpend.toFixed(2)),
      impressions: totalImpressions,
      clicks: totalClicks,
      conversions: totalConversions,
      cpc: totalClicks > 0 ? Number((totalSpend / totalClicks).toFixed(2)) : 0,
      cpm:
        totalImpressions > 0
          ? Number(((totalSpend / totalImpressions) * 1000).toFixed(2))
          : 0,
    },
    rows,
  };
}
