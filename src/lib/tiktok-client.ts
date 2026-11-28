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

export type TikTokReportDataLevel =
  | "AUCTION_CAMPAIGN"
  | "AUCTION_ADGROUP"
  | "AUCTION_AD";

export type TikTokOptimizationSignalStatus =
  | "SCALE"
  | "CONTROL_CPA"
  | "OPTIMIZE_CREATIVE"
  | "OPTIMIZE_CHECKOUT"
  | "FATIGUE"
  | "LEARNING"
  | "STABLE";

export interface TikTokOptimizationDiagnosis {
  status: TikTokOptimizationSignalStatus;
  label: string;
  reason: string;
  action: string;
}

export interface TikTokReadOnlyReportRow {
  statDate: string;
  campaignId: string;
  campaignName: string;
  adgroupId?: string;
  adgroupName?: string;
  adId?: string;
  adName?: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  purchases: number;
  cpa: number;
  conversionRate: number;
  attributedRevenue: number;
  roas: number;
  estimatedProfit: number;
  initiateCheckout: number;
  costPerCheckout: number;
  checkoutToPurchaseRate: number;
  videoWatched2s: number;
  videoWatched6s: number;
  hookRate2s: number;
  holdRate6s: number;
  optimization: TikTokOptimizationDiagnosis;
}

export interface TikTokReadOnlyReportResult {
  advertiserId: string;
  dataLevel: TikTokReportDataLevel;
  startDate: string;
  endDate: string;
  metricsFallbackUsed?: boolean;
  totals: {
    spend: number;
    impressions: number;
    reach: number;
    frequency: number;
    clicks: number;
    ctr: number;
    conversions: number;
    purchases: number;
    cpa: number;
    conversionRate: number;
    attributedRevenue: number;
    roas: number;
    estimatedProfit: number;
    initiateCheckout: number;
    costPerCheckout: number;
    checkoutToPurchaseRate: number;
    hookRate2s: number;
    holdRate6s: number;
    cpc: number;
    cpm: number;
  };
  rows: TikTokReadOnlyReportRow[];
}

function safeMetricNum(val: unknown): number {
  const n = Number(val ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function round2(val: number): number {
  return Number.isFinite(val) ? Number(val.toFixed(2)) : 0;
}

/**
 * Gera diagnóstico objetivo de otimização de campanha a partir das métricas oficiais do TikTok Ads.
 * - Não recomenda escalar/pausar com amostra insuficiente.
 * - Separa problemas de criativo (CTR/Hook), checkout (IC -> Compra), fadiga (Frequência) e CPA/ROAS.
 */
export function evaluateTikTokRowOptimization(input: {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  purchases: number;
  cpa: number;
  roas: number;
  estimatedProfit: number;
  initiateCheckout: number;
  checkoutToPurchaseRate: number;
  frequency: number;
  hookRate2s: number;
}): TikTokOptimizationDiagnosis {
  if (input.spend < 30 && input.impressions < 1000) {
    return {
      status: "LEARNING",
      label: "Em aprendizado",
      reason: "Volume ainda baixo para decisão definitiva.",
      action: "Aguarde acumular mais impressões e gasto antes de pausar ou escalar.",
    };
  }

  if (input.purchases >= 3 && input.roas >= 2.5 && input.estimatedProfit > 0) {
    return {
      status: "SCALE",
      label: "Pronta para escalar",
      reason: `ROAS em ${input.roas.toFixed(2)}x com ${input.purchases} compra(s) e lucro estimado positivo.`,
      action: "Avalie aumento gradual de orçamento (15% a 25%) acompanhando CPA e frequência.",
    };
  }

  if (input.frequency >= 3.2 && input.ctr < 1.5) {
    return {
      status: "FATIGUE",
      label: "Fadiga de criativo",
      reason: `Frequência elevada (${input.frequency.toFixed(2)}) com CTR em ${input.ctr.toFixed(2)}%.`,
      action: "Renove criativos ou amplie o público para reduzir saturação.",
    };
  }

  if (input.spend >= 50 && input.purchases === 0) {
    if (input.initiateCheckout >= 3) {
      return {
        status: "OPTIMIZE_CHECKOUT",
        label: "Gargalo no checkout",
        reason: `${input.initiateCheckout} inícios de checkout sem compras concluídas.`,
        action: "Revise oferta, frete, meios de pagamento (PIX) e velocidade do checkout.",
      };
    }
    if (input.ctr < 1.2 || (input.hookRate2s > 0 && input.hookRate2s < 18)) {
      return {
        status: "OPTIMIZE_CREATIVE",
        label: "Otimizar criativo",
        reason: `CTR baixo (${input.ctr.toFixed(2)}%)${input.hookRate2s > 0 ? ` e Hook 2s em ${input.hookRate2s.toFixed(1)}%` : ""}.`,
        action: "Teste novos ganchos nos primeiros 3 segundos do vídeo.",
      };
    }
    return {
      status: "CONTROL_CPA",
      label: "Sem compras — revisar",
      reason: `Gasto acumulado de R$ ${input.spend.toFixed(2)} sem compras atribuídas.`,
      action: "Verifique o Pixel/Events API, página de vendas e conjuntos com maior custo.",
    };
  }

  if (input.initiateCheckout >= 5 && input.checkoutToPurchaseRate < 20) {
    return {
      status: "OPTIMIZE_CHECKOUT",
      label: "Otimizar checkout",
      reason: `Conversão de checkout para compra em ${input.checkoutToPurchaseRate.toFixed(1)}%.`,
      action: "Melhore prova social, quebra de objeções e fluidez do pagamento.",
    };
  }

  if (input.estimatedProfit < 0 && input.spend >= 60) {
    return {
      status: "CONTROL_CPA",
      label: "Controlar CPA",
      reason: `CPA em R$ ${input.cpa.toFixed(2)} com ROAS ${input.roas.toFixed(2)}x e lucro negativo.`,
      action: "Corte anúncios com CPA mais alto e concentre verba nos melhores criativos.",
    };
  }

  if (input.impressions >= 1500 && input.ctr < 1.2) {
    return {
      status: "OPTIMIZE_CREATIVE",
      label: "Melhorar CTR / Hook",
      reason: `CTR em ${input.ctr.toFixed(2)}% abaixo do ideal para TikTok.`,
      action: "Suba variações de gancho visual nos 2 primeiros segundos.",
    };
  }

  return {
    status: "STABLE",
    label: "Estável — acompanhar",
    reason: "Indicadores equilibrados no período selecionado.",
    action: "Mantenha a estrutura atual e compare com sua meta em Minhas Métricas.",
  };
}

const FULL_OPTIMIZATION_METRICS = [
  "spend",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "conversion",
  "cost_per_conversion",
  "conversion_rate",
  "complete_payment",
  "cost_per_complete_payment",
  "value_per_complete_payment",
  "complete_payment_roas",
  "initiate_checkout",
  "cost_per_initiate_checkout",
  "video_watched_2s",
  "video_watched_6s",
];

const CORE_FALLBACK_METRICS = [
  "spend",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "conversion",
  "cost_per_conversion",
  "conversion_rate",
];

/**
 * Consulta SOMENTE-LEITURA de gastos, compras, CPA, ROAS, lucro estimado e métricas
 * de otimização (CTR, CVR, IC, Frequência, Hook 2s, Hold 6s) na TikTok Marketing API v1.3.
 * Endpoint oficial: GET /open_api/v1.3/report/integrated/get/
 * NÃO cria, edita nem exclui campanhas ou anúncios.
 */
export async function fetchTikTokReadOnlyReport(
  params: {
    accessToken: string;
    advertiserId: string;
    startDate: string;
    endDate: string;
    dataLevel?: TikTokReportDataLevel;
  },
  fetchImpl: typeof fetch = fetch
): Promise<TikTokReadOnlyReportResult> {
  const dataLevel: TikTokReportDataLevel = params.dataLevel || "AUCTION_CAMPAIGN";

  const dimensions =
    dataLevel === "AUCTION_AD"
      ? ["ad_id", "stat_time_day"]
      : dataLevel === "AUCTION_ADGROUP"
        ? ["adgroup_id", "stat_time_day"]
        : ["campaign_id", "stat_time_day"];

  const nameMetric =
    dataLevel === "AUCTION_AD"
      ? ["campaign_name", "adgroup_name", "ad_name"]
      : dataLevel === "AUCTION_ADGROUP"
        ? ["campaign_name", "adgroup_name"]
        : ["campaign_name"];

  async function executeQuery(metricList: string[]) {
    const url = new URL(`${TIKTOK_API_BASE_URL}/report/integrated/get/`);
    url.searchParams.set("advertiser_id", params.advertiserId);
    url.searchParams.set("report_type", "BASIC");
    url.searchParams.set("data_level", dataLevel);
    url.searchParams.set("dimensions", JSON.stringify(dimensions));
    url.searchParams.set(
      "metrics",
      JSON.stringify([...nameMetric, ...metricList])
    );
    url.searchParams.set("start_date", params.startDate);
    url.searchParams.set("end_date", params.endDate);
    url.searchParams.set("page", "1");
    url.searchParams.set("page_size", "200");

    const res = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        "Access-Token": params.accessToken,
      },
      cache: "no-store",
    });

    return parseTikTokJson<{
      list?: Array<{
        dimensions?: Record<string, string | number | undefined>;
        metrics?: Record<string, string | number | undefined>;
      }>;
    }>(res);
  }

  let data: {
    list?: Array<{
      dimensions?: Record<string, string | number | undefined>;
      metrics?: Record<string, string | number | undefined>;
    }>;
  };
  let metricsFallbackUsed = false;

  try {
    data = await executeQuery(FULL_OPTIMIZATION_METRICS);
  } catch (err) {
    // Se a conta não suportar alguma métrica avançada (ex.: pixel/vídeo), faz fallback limpo para as métricas base
    if (
      err instanceof TikTokApiError &&
      err.category !== "INVALID_TOKEN" &&
      err.category !== "UNAVAILABLE_ACCOUNT" &&
      (err.code === 40002 || err.message.toLowerCase().includes("metric"))
    ) {
      metricsFallbackUsed = true;
      data = await executeQuery(CORE_FALLBACK_METRICS);
    } else {
      throw err;
    }
  }

  const list = Array.isArray(data.list) ? data.list : [];
  const rows: TikTokReadOnlyReportRow[] = list.map((item) => {
    const dim = item.dimensions || {};
    const m = item.metrics || {};

    const spend = round2(Math.max(0, safeMetricNum(m.spend)));
    const impressions = Math.max(0, Math.round(safeMetricNum(m.impressions)));
    const reach = Math.max(0, Math.round(safeMetricNum(m.reach)));
    const frequency = round2(
      safeMetricNum(m.frequency) || (reach > 0 ? impressions / reach : 0)
    );
    const clicks = Math.max(0, Math.round(safeMetricNum(m.clicks)));
    const ctr = round2(
      safeMetricNum(m.ctr) || (impressions > 0 ? (clicks / impressions) * 100 : 0)
    );
    const cpc = round2(
      safeMetricNum(m.cpc) || (clicks > 0 ? spend / clicks : 0)
    );
    const cpm = round2(
      safeMetricNum(m.cpm) || (impressions > 0 ? (spend / impressions) * 1000 : 0)
    );

    const conversions = Math.max(0, Math.round(safeMetricNum(m.conversion)));
    const completePayment = Math.max(
      0,
      Math.round(safeMetricNum(m.complete_payment))
    );
    const purchases = completePayment > 0 ? completePayment : conversions;

    const cpaApi =
      safeMetricNum(m.cost_per_complete_payment) ||
      safeMetricNum(m.cost_per_conversion);
    const cpa = round2(
      cpaApi > 0 ? cpaApi : purchases > 0 ? spend / purchases : 0
    );

    const conversionRate = round2(
      safeMetricNum(m.conversion_rate) ||
        (clicks > 0 ? (purchases / clicks) * 100 : 0)
    );

    const valuePerPurchase = safeMetricNum(m.value_per_complete_payment);
    const apiRoas = safeMetricNum(m.complete_payment_roas);
    const attributedRevenue = round2(
      completePayment > 0 && valuePerPurchase > 0
        ? completePayment * valuePerPurchase
        : spend > 0 && apiRoas > 0
          ? spend * apiRoas
          : 0
    );
    const roas = round2(
      apiRoas > 0 ? apiRoas : spend > 0 ? attributedRevenue / spend : 0
    );
    const estimatedProfit = round2(attributedRevenue - spend);

    const initiateCheckout = Math.max(
      0,
      Math.round(safeMetricNum(m.initiate_checkout))
    );
    const costPerCheckout = round2(
      safeMetricNum(m.cost_per_initiate_checkout) ||
        (initiateCheckout > 0 ? spend / initiateCheckout : 0)
    );
    const checkoutToPurchaseRate = round2(
      initiateCheckout > 0 ? (purchases / initiateCheckout) * 100 : 0
    );

    const videoWatched2s = Math.max(
      0,
      Math.round(safeMetricNum(m.video_watched_2s))
    );
    const videoWatched6s = Math.max(
      0,
      Math.round(safeMetricNum(m.video_watched_6s))
    );
    const hookRate2s = round2(
      impressions > 0 ? (videoWatched2s / impressions) * 100 : 0
    );
    const holdRate6s = round2(
      impressions > 0 ? (videoWatched6s / impressions) * 100 : 0
    );

    const rawDate = String(dim.stat_time_day || params.endDate).slice(0, 10);
    const campaignId = String(dim.campaign_id || dim.adgroup_id || dim.ad_id || "");
    const campaignName =
      String(m.campaign_name || "").trim() ||
      `Campanha ${dim.campaign_id || campaignId}`.trim();
    const adgroupName = String(m.adgroup_name || "").trim() || undefined;
    const adName = String(m.ad_name || "").trim() || undefined;

    const optimization = evaluateTikTokRowOptimization({
      spend,
      impressions,
      clicks,
      ctr,
      purchases,
      cpa,
      roas,
      estimatedProfit,
      initiateCheckout,
      checkoutToPurchaseRate,
      frequency,
      hookRate2s,
    });

    return {
      statDate: rawDate,
      campaignId,
      campaignName,
      adgroupId: dim.adgroup_id ? String(dim.adgroup_id) : undefined,
      adgroupName,
      adId: dim.ad_id ? String(dim.ad_id) : undefined,
      adName,
      spend,
      impressions,
      reach,
      frequency,
      clicks,
      ctr,
      cpc,
      cpm,
      conversions,
      purchases,
      cpa,
      conversionRate,
      attributedRevenue,
      roas,
      estimatedProfit,
      initiateCheckout,
      costPerCheckout,
      checkoutToPurchaseRate,
      videoWatched2s,
      videoWatched6s,
      hookRate2s,
      holdRate6s,
      optimization,
    };
  });

  const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
  const totalReach = rows.reduce((s, r) => s + r.reach, 0);
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalConversions = rows.reduce((s, r) => s + r.conversions, 0);
  const totalPurchases = rows.reduce((s, r) => s + r.purchases, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.attributedRevenue, 0);
  const totalCheckouts = rows.reduce((s, r) => s + r.initiateCheckout, 0);
  const totalVideo2s = rows.reduce((s, r) => s + r.videoWatched2s, 0);
  const totalVideo6s = rows.reduce((s, r) => s + r.videoWatched6s, 0);

  return {
    advertiserId: params.advertiserId,
    dataLevel,
    startDate: params.startDate,
    endDate: params.endDate,
    metricsFallbackUsed,
    totals: {
      spend: round2(totalSpend),
      impressions: totalImpressions,
      reach: totalReach,
      frequency: round2(totalReach > 0 ? totalImpressions / totalReach : 0),
      clicks: totalClicks,
      ctr: round2(totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0),
      conversions: totalConversions,
      purchases: totalPurchases,
      cpa: round2(totalPurchases > 0 ? totalSpend / totalPurchases : 0),
      conversionRate: round2(
        totalClicks > 0 ? (totalPurchases / totalClicks) * 100 : 0
      ),
      attributedRevenue: round2(totalRevenue),
      roas: round2(totalSpend > 0 ? totalRevenue / totalSpend : 0),
      estimatedProfit: round2(totalRevenue - totalSpend),
      initiateCheckout: totalCheckouts,
      costPerCheckout: round2(
        totalCheckouts > 0 ? totalSpend / totalCheckouts : 0
      ),
      checkoutToPurchaseRate: round2(
        totalCheckouts > 0 ? (totalPurchases / totalCheckouts) * 100 : 0
      ),
      hookRate2s: round2(
        totalImpressions > 0 ? (totalVideo2s / totalImpressions) * 100 : 0
      ),
      holdRate6s: round2(
        totalImpressions > 0 ? (totalVideo6s / totalImpressions) * 100 : 0
      ),
      cpc: round2(totalClicks > 0 ? totalSpend / totalClicks : 0),
      cpm: round2(
        totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0
      ),
    },
    rows,
  };
}
