import type { TikTokCampaignRecord } from "./db";
import type { PeriodPreset } from "./dashfy-types";

export type MetricId =
  | "cpa"
  | "cpm"
  | "cpc"
  | "ctr"
  | "roas"
  | "conversions"
  | "attributed_revenue"
  | "estimated_profit"
  | "impressions"
  | "clicks"
  | "frequency"
  | "cost_per_result"
  | "conversion_rate"
  | "spend";

export type MetricCategory = "traffic" | "conversion" | "financial";
export type MetricDirection = "lower_is_better" | "higher_is_better";
export type MetricUnit = "currency" | "percent" | "multiplier" | "integer" | "decimal";
export type MetricGoalType = "min" | "max" | "range" | "growth_pct";
export type MetricEvalStatus =
  | "on_target"
  | "attention"
  | "off_target"
  | "insufficient_data";
export type CampaignObjective =
  | "conversion"
  | "traffic"
  | "awareness"
  | "financial"
  | "creatives";

export interface MetricDefinition {
  id: MetricId;
  label: string;
  shortLabel: string;
  description: string;
  category: MetricCategory;
  direction: MetricDirection;
  unit: MetricUnit;
  defaultGoalType: MetricGoalType;
  defaultTarget: number;
  defaultMaxTarget?: number;
  minSampleHint: string;
}

export interface MetricGoalConfig {
  metricId: MetricId;
  enabled: boolean;
  goalType: MetricGoalType;
  targetValue: number;
  maxValue?: number; // utilizado quando goalType === "range"
  attentionTolerancePct?: number; // padrão 15%
  alertEnabled?: boolean;
}

export interface MetricAlertSettings {
  enabled: boolean;
  alertOnCpaAbove: boolean;
  alertOnRoasBelow: boolean;
  alertOnCtrDrop: boolean;
  alertOnNegativeProfit: boolean;
  alertOnGoalAchieved: boolean;
  alertOnSpendWithoutPurchases: boolean;
  ctrDropThresholdPct: number; // ex.: 20% queda vs período anterior
  spendWithoutPurchasesThreshold: number; // ex.: R$ 50 sem vendas
  minSpendForAlerts: number; // limite mínimo de dados
  minClicksForAlerts: number;
  minConversionsForAlerts: number;
  cooldownHours: number; // evita alertas repetidos
}

export interface MetricDailyPoint {
  date: string;
  value: number | null;
}

export interface EvaluatedMetricCard {
  definition: MetricDefinition;
  goal: MetricGoalConfig | null;
  currentValue: number | null;
  previousValue: number | null;
  formattedCurrent: string;
  formattedGoal: string;
  absoluteDiff: number | null;
  formattedAbsDiff: string;
  percentDiff: number | null;
  formattedPctDiff: string;
  trendPct: number | null;
  trendDirection: "up" | "down" | "flat" | "unknown";
  trendIsFavorable: boolean | null;
  status: MetricEvalStatus;
  statusLabel: string;
  statusReason: string;
  progressPct: number; // 0..100 para barra visual
  confidence: "high" | "low" | "none";
  dailySeries: MetricDailyPoint[];
}

export interface CampaignMetricsSummary {
  configuredCount: number;
  achievedCount: number;
  attentionCount: number;
  missedCount: number;
  insufficientDataCount: number;
  overallTrend: "improving" | "declining" | "stable" | "insufficient_data";
  overallTrendLabel: string;
  financialHealth: "profitable" | "breakeven" | "losing" | "insufficient_data";
  financialHealthLabel: string;
  financialWarning: string | null;
  totalSpend: number;
  totalRevenue: number;
  totalProfit: number;
  totalConversions: number;
  totalClicks: number;
  totalImpressions: number;
}

export interface MetricTemplateDefinition {
  id: string;
  name: string;
  description: string;
  objective: CampaignObjective;
  isBuiltIn: boolean;
  selectedMetrics: MetricId[];
  goals: Record<string, MetricGoalConfig>;
  alertSettings: MetricAlertSettings;
}

export interface AssistantInsight {
  id: string;
  severity: "positive" | "warning" | "critical" | "info";
  title: string;
  message: string;
  metricId?: MetricId;
  category: MetricCategory | "general";
}

export interface EvaluatedMetricAlert {
  dedupeKey: string;
  metricId: MetricId | "campaign";
  alertType:
    | "cpa_above"
    | "roas_below"
    | "ctr_drop"
    | "negative_profit"
    | "goal_achieved"
    | "spend_no_purchases";
  severity: "critical" | "warning" | "positive";
  title: string;
  message: string;
}

export interface CpaRoasCalculatorInput {
  averageTicket: number;
  productCost: number;
  gatewayFeePct: number;
  desiredProfitMarginPct: number;
}

export interface CpaRoasCalculatorResult {
  contributionMarginPerSale: number;
  breakEvenCpa: number;
  breakEvenRoas: number;
  targetMaxCpa: number;
  targetMinRoas: number;
  feasible: boolean;
  note: string;
}

export const METRIC_CATEGORY_LABELS: Record<MetricCategory, string> = {
  traffic: "Tráfego",
  conversion: "Conversão",
  financial: "Financeiro",
};

export const OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  conversion: "Conversão / Vendas",
  traffic: "Tráfego / Cliques",
  awareness: "Reconhecimento / Alcance",
  financial: "Análise Financeira",
  creatives: "Análise de Criativos",
};

export const METRIC_DEFINITIONS: Record<MetricId, MetricDefinition> = {
  cpa: {
    id: "cpa",
    label: "CPA (Custo por Aquisição)",
    shortLabel: "CPA",
    description: "Investimento dividido pelas compras atribuídas no período.",
    category: "conversion",
    direction: "lower_is_better",
    unit: "currency",
    defaultGoalType: "max",
    defaultTarget: 20,
    minSampleHint: "Exige ao menos 1 compra atribuída (ideal >= 5 para alta confiança).",
  },
  cpm: {
    id: "cpm",
    label: "CPM (Custo por Mil Impressões)",
    shortLabel: "CPM",
    description: "Custo médio para exibir seu anúncio 1.000 vezes no TikTok.",
    category: "traffic",
    direction: "lower_is_better",
    unit: "currency",
    defaultGoalType: "max",
    defaultTarget: 25,
    minSampleHint: "Exige ao menos 100 impressões.",
  },
  cpc: {
    id: "cpc",
    label: "CPC (Custo por Clique)",
    shortLabel: "CPC",
    description: "Valor médio pago por cada clique registrado no anúncio.",
    category: "traffic",
    direction: "lower_is_better",
    unit: "currency",
    defaultGoalType: "max",
    defaultTarget: 1,
    minSampleHint: "Exige ao menos 1 clique.",
  },
  ctr: {
    id: "ctr",
    label: "CTR (Taxa de Cliques)",
    shortLabel: "CTR",
    description: "Percentual de impressões que resultaram em clique (Cliques / Impressões).",
    category: "traffic",
    direction: "higher_is_better",
    unit: "percent",
    defaultGoalType: "min",
    defaultTarget: 2,
    minSampleHint: "Exige ao menos 100 impressões.",
  },
  roas: {
    id: "roas",
    label: "ROAS (Retorno sobre Anúncios)",
    shortLabel: "ROAS",
    description: "Receita atribuída dividida pelo investimento em mídia.",
    category: "financial",
    direction: "higher_is_better",
    unit: "multiplier",
    defaultGoalType: "min",
    defaultTarget: 3,
    minSampleHint: "Exige investimento maior que R$ 0 (ideal >= 5 compras).",
  },
  conversions: {
    id: "conversions",
    label: "Compras Atribuídas",
    shortLabel: "Compras",
    description: "Quantidade total de conversões/compras atribuídas à campanha.",
    category: "conversion",
    direction: "higher_is_better",
    unit: "integer",
    defaultGoalType: "min",
    defaultTarget: 10,
    minSampleHint: "Baseado nas conversões sincronizadas ou importadas.",
  },
  attributed_revenue: {
    id: "attributed_revenue",
    label: "Receita Atribuída",
    shortLabel: "Receita",
    description: "Soma da receita atribuída às conversões da campanha no período.",
    category: "financial",
    direction: "higher_is_better",
    unit: "currency",
    defaultGoalType: "min",
    defaultTarget: 1000,
    minSampleHint: "Baseado na receita atribuída registrada na operação.",
  },
  estimated_profit: {
    id: "estimated_profit",
    label: "Lucro Estimado",
    shortLabel: "Lucro Est.",
    description: "Receita atribuída menos o investimento direto da campanha.",
    category: "financial",
    direction: "higher_is_better",
    unit: "currency",
    defaultGoalType: "min",
    defaultTarget: 300,
    minSampleHint: "Exige investimento ou receita registrados no período.",
  },
  impressions: {
    id: "impressions",
    label: "Impressões",
    shortLabel: "Impressões",
    description: "Número total de vezes que os anúncios foram exibidos.",
    category: "traffic",
    direction: "higher_is_better",
    unit: "integer",
    defaultGoalType: "min",
    defaultTarget: 15000,
    minSampleHint: "Volume de entrega da campanha.",
  },
  clicks: {
    id: "clicks",
    label: "Cliques",
    shortLabel: "Cliques",
    description: "Quantidade total de cliques nos anúncios da campanha.",
    category: "traffic",
    direction: "higher_is_better",
    unit: "integer",
    defaultGoalType: "min",
    defaultTarget: 300,
    minSampleHint: "Volume de cliques gerados.",
  },
  frequency: {
    id: "frequency",
    label: "Frequência",
    shortLabel: "Frequência",
    description:
      "Média de exibições por usuário único (disponível quando alcance é sincronizado pela TikTok API).",
    category: "traffic",
    direction: "lower_is_better",
    unit: "decimal",
    defaultGoalType: "range",
    defaultTarget: 1.0,
    defaultMaxTarget: 2.5,
    minSampleHint: "Exige métrica de alcance (reach) da TikTok Marketing API.",
  },
  cost_per_result: {
    id: "cost_per_result",
    label: "Custo por Resultado",
    shortLabel: "Custo/Res.",
    description: "Investimento total dividido pelos resultados/conversões obtidos.",
    category: "conversion",
    direction: "lower_is_better",
    unit: "currency",
    defaultGoalType: "max",
    defaultTarget: 20,
    minSampleHint: "Exige ao menos 1 resultado registrado.",
  },
  conversion_rate: {
    id: "conversion_rate",
    label: "Taxa de Conversão (CVR)",
    shortLabel: "CVR",
    description: "Percentual de cliques que geraram compra (Compras / Cliques).",
    category: "conversion",
    direction: "higher_is_better",
    unit: "percent",
    defaultGoalType: "min",
    defaultTarget: 2,
    minSampleHint: "Exige ao menos 10 cliques para leitura confiável.",
  },
  spend: {
    id: "spend",
    label: "Investimento em Mídia",
    shortLabel: "Investimento",
    description: "Valor total investido na campanha durante o período selecionado.",
    category: "financial",
    direction: "lower_is_better",
    unit: "currency",
    defaultGoalType: "max",
    defaultTarget: 1000,
    minSampleHint: "Gasto acumulado no período.",
  },
};

export const ALL_METRIC_IDS = Object.keys(METRIC_DEFINITIONS) as MetricId[];

export const DEFAULT_ALERT_SETTINGS: MetricAlertSettings = {
  enabled: true,
  alertOnCpaAbove: true,
  alertOnRoasBelow: true,
  alertOnCtrDrop: true,
  alertOnNegativeProfit: true,
  alertOnGoalAchieved: true,
  alertOnSpendWithoutPurchases: true,
  ctrDropThresholdPct: 20,
  spendWithoutPurchasesThreshold: 60,
  minSpendForAlerts: 30,
  minClicksForAlerts: 20,
  minConversionsForAlerts: 2,
  cooldownHours: 12,
};

function makeGoal(
  metricId: MetricId,
  goalType: MetricGoalType,
  targetValue: number,
  maxValue?: number
): MetricGoalConfig {
  return {
    metricId,
    enabled: true,
    goalType,
    targetValue,
    maxValue,
    attentionTolerancePct: 15,
    alertEnabled: true,
  };
}

export const BUILT_IN_METRIC_TEMPLATES: MetricTemplateDefinition[] = [
  {
    id: "builtin_conversion",
    name: "Campanhas de Conversão",
    description:
      "Foco em CPA máximo, ROAS mínimo, compras atribuídas, receita, CTR e lucro estimado.",
    objective: "conversion",
    isBuiltIn: true,
    selectedMetrics: [
      "cpa",
      "roas",
      "conversions",
      "attributed_revenue",
      "estimated_profit",
      "ctr",
    ],
    goals: {
      cpa: makeGoal("cpa", "max", 20),
      roas: makeGoal("roas", "min", 3),
      conversions: makeGoal("conversions", "min", 10),
      attributed_revenue: makeGoal("attributed_revenue", "min", 1000),
      estimated_profit: makeGoal("estimated_profit", "min", 300),
      ctr: makeGoal("ctr", "min", 2),
    },
    alertSettings: { ...DEFAULT_ALERT_SETTINGS },
  },
  {
    id: "builtin_traffic",
    name: "Campanhas de Tráfego",
    description:
      "Controle de CPC máximo, CTR mínimo, CPM máximo e volume de cliques qualificados.",
    objective: "traffic",
    isBuiltIn: true,
    selectedMetrics: ["cpc", "ctr", "cpm", "clicks", "impressions", "spend"],
    goals: {
      cpc: makeGoal("cpc", "max", 1),
      ctr: makeGoal("ctr", "min", 2),
      cpm: makeGoal("cpm", "max", 25),
      clicks: makeGoal("clicks", "min", 400),
      impressions: makeGoal("impressions", "min", 20000),
      spend: makeGoal("spend", "max", 500),
    },
    alertSettings: {
      ...DEFAULT_ALERT_SETTINGS,
      alertOnSpendWithoutPurchases: false,
      alertOnRoasBelow: false,
    },
  },
  {
    id: "builtin_awareness",
    name: "Campanhas de Reconhecimento",
    description:
      "Eficiência de alcance, CPM competitivo, volume de impressões e controle de frequência.",
    objective: "awareness",
    isBuiltIn: true,
    selectedMetrics: ["cpm", "impressions", "ctr", "frequency", "clicks", "spend"],
    goals: {
      cpm: makeGoal("cpm", "max", 18),
      impressions: makeGoal("impressions", "min", 50000),
      ctr: makeGoal("ctr", "min", 1),
      frequency: makeGoal("frequency", "range", 1.0, 2.5),
      clicks: makeGoal("clicks", "min", 500),
      spend: makeGoal("spend", "max", 800),
    },
    alertSettings: {
      ...DEFAULT_ALERT_SETTINGS,
      alertOnSpendWithoutPurchases: false,
      alertOnCpaAbove: false,
      alertOnRoasBelow: false,
    },
  },
  {
    id: "builtin_financial",
    name: "Análise Financeira",
    description:
      "Visão executiva de lucro estimado, ROAS, receita atribuída, investimento e CPA.",
    objective: "financial",
    isBuiltIn: true,
    selectedMetrics: [
      "estimated_profit",
      "roas",
      "attributed_revenue",
      "spend",
      "cpa",
      "conversions",
    ],
    goals: {
      estimated_profit: makeGoal("estimated_profit", "min", 300),
      roas: makeGoal("roas", "min", 3),
      attributed_revenue: makeGoal("attributed_revenue", "min", 1500),
      spend: makeGoal("spend", "max", 1000),
      cpa: makeGoal("cpa", "max", 22),
      conversions: makeGoal("conversions", "min", 15),
    },
    alertSettings: { ...DEFAULT_ALERT_SETTINGS },
  },
  {
    id: "builtin_creatives",
    name: "Análise de Criativos",
    description:
      "Avalie gancho e atratividade com CTR, CPC, CPM, taxa de conversão (CVR) e cliques.",
    objective: "creatives",
    isBuiltIn: true,
    selectedMetrics: [
      "ctr",
      "cpc",
      "cpm",
      "conversion_rate",
      "clicks",
      "cost_per_result",
    ],
    goals: {
      ctr: makeGoal("ctr", "min", 2.2),
      cpc: makeGoal("cpc", "max", 0.9),
      cpm: makeGoal("cpm", "max", 25),
      conversion_rate: makeGoal("conversion_rate", "min", 2),
      clicks: makeGoal("clicks", "min", 300),
      cost_per_result: makeGoal("cost_per_result", "max", 20),
    },
    alertSettings: { ...DEFAULT_ALERT_SETTINGS },
  },
];

export function getDefaultMetricSetup(): {
  objective: CampaignObjective;
  selectedMetrics: MetricId[];
  goals: Record<string, MetricGoalConfig>;
  alertSettings: MetricAlertSettings;
} {
  const tpl = BUILT_IN_METRIC_TEMPLATES[0];
  return {
    objective: tpl.objective,
    selectedMetrics: [...tpl.selectedMetrics],
    goals: JSON.parse(JSON.stringify(tpl.goals)),
    alertSettings: { ...tpl.alertSettings },
  };
}

export function formatMetricValue(
  value: number | null | undefined,
  unit: MetricUnit
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  switch (unit) {
    case "currency":
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    case "percent":
      return `${value.toFixed(2).replace(".", ",")}%`;
    case "multiplier":
      return `${value.toFixed(2).replace(".", ",")}x`;
    case "integer":
      return Math.round(value).toLocaleString("pt-BR");
    case "decimal":
      return value.toFixed(2).replace(".", ",");
  }
}

export function formatGoalTarget(
  goal: MetricGoalConfig | null | undefined,
  def: MetricDefinition
): string {
  if (!goal || !goal.enabled) return "Sem meta";
  if (goal.goalType === "min") {
    return `Mín. ${formatMetricValue(goal.targetValue, def.unit)}`;
  }
  if (goal.goalType === "max") {
    return `Máx. ${formatMetricValue(goal.targetValue, def.unit)}`;
  }
  if (goal.goalType === "range") {
    const hi =
      typeof goal.maxValue === "number" && Number.isFinite(goal.maxValue)
        ? goal.maxValue
        : goal.targetValue;
    return `${formatMetricValue(goal.targetValue, def.unit)} a ${formatMetricValue(hi, def.unit)}`;
  }
  const sign = goal.targetValue >= 0 ? "+" : "";
  return `${sign}${goal.targetValue.toFixed(1).replace(".", ",")}% vs período ant.`;
}

export interface CampaignAggregateNumbers {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  attributedRevenue: number;
  reach?: number | null;
}

export function aggregateCampaignRows(
  rows: TikTokCampaignRecord[]
): CampaignAggregateNumbers {
  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let conversions = 0;
  let attributedRevenue = 0;

  for (const r of rows) {
    spend += Number(r.spend || 0);
    impressions += Number(r.impressions || 0);
    clicks += Number(r.clicks || 0);
    conversions += Number(r.conversions || 0);
    attributedRevenue += Number(r.attributedRevenue || 0);
  }

  return {
    spend,
    impressions,
    clicks,
    conversions,
    attributedRevenue,
    reach: null,
  };
}

/**
 * Extrai o valor real de um indicador a partir dos números agregados da campanha.
 * Retorna `null` quando não há base de dados suficiente (nunca inventa dados).
 */
export function computeRawMetricValue(
  metricId: MetricId,
  agg: CampaignAggregateNumbers
): { value: number | null; confidence: "high" | "low" | "none" } {
  const hasAnyActivity =
    agg.spend > 0 ||
    agg.impressions > 0 ||
    agg.clicks > 0 ||
    agg.conversions > 0 ||
    agg.attributedRevenue > 0;

  if (!hasAnyActivity) {
    return { value: null, confidence: "none" };
  }

  switch (metricId) {
    case "cpa":
    case "cost_per_result": {
      if (agg.conversions <= 0) {
        return { value: null, confidence: "none" };
      }
      return {
        value: agg.spend / agg.conversions,
        confidence: agg.conversions >= 5 ? "high" : "low",
      };
    }
    case "cpm": {
      if (agg.impressions < 100) {
        return { value: null, confidence: "none" };
      }
      return {
        value: (agg.spend / agg.impressions) * 1000,
        confidence: agg.impressions >= 1000 ? "high" : "low",
      };
    }
    case "cpc": {
      if (agg.clicks <= 0) {
        return { value: null, confidence: "none" };
      }
      return {
        value: agg.spend / agg.clicks,
        confidence: agg.clicks >= 20 ? "high" : "low",
      };
    }
    case "ctr": {
      if (agg.impressions < 100) {
        return { value: null, confidence: "none" };
      }
      return {
        value: (agg.clicks / agg.impressions) * 100,
        confidence: agg.impressions >= 1000 ? "high" : "low",
      };
    }
    case "roas": {
      if (agg.spend <= 0) {
        return { value: null, confidence: "none" };
      }
      return {
        value: agg.attributedRevenue / agg.spend,
        confidence: agg.conversions >= 5 || agg.spend >= 150 ? "high" : "low",
      };
    }
    case "conversions": {
      return {
        value: agg.conversions,
        confidence: agg.spend > 0 || agg.clicks > 0 ? (agg.conversions >= 5 ? "high" : "low") : "none",
      };
    }
    case "attributed_revenue": {
      return {
        value: agg.attributedRevenue,
        confidence: agg.spend > 0 || agg.attributedRevenue > 0 ? "high" : "none",
      };
    }
    case "estimated_profit": {
      if (agg.spend <= 0 && agg.attributedRevenue <= 0) {
        return { value: null, confidence: "none" };
      }
      return {
        value: agg.attributedRevenue - agg.spend,
        confidence: agg.conversions >= 3 || agg.spend >= 100 ? "high" : "low",
      };
    }
    case "impressions": {
      return {
        value: agg.impressions,
        confidence: agg.impressions > 0 ? "high" : "none",
      };
    }
    case "clicks": {
      return {
        value: agg.clicks,
        confidence: agg.clicks > 0 ? "high" : "none",
      };
    }
    case "frequency": {
      if (!agg.reach || agg.reach <= 0 || agg.impressions <= 0) {
        return { value: null, confidence: "none" };
      }
      return {
        value: agg.impressions / agg.reach,
        confidence: agg.impressions >= 1000 ? "high" : "low",
      };
    }
    case "conversion_rate": {
      if (agg.clicks < 10) {
        return { value: null, confidence: "none" };
      }
      return {
        value: (agg.conversions / agg.clicks) * 100,
        confidence: agg.clicks >= 50 ? "high" : "low",
      };
    }
    case "spend": {
      return {
        value: agg.spend,
        confidence: agg.spend > 0 ? "high" : "none",
      };
    }
  }
}

/**
 * Calcula série diária de um indicador específico para sparkline e gráfico detalhado.
 */
export function buildMetricDailySeries(
  metricId: MetricId,
  rows: TikTokCampaignRecord[]
): MetricDailyPoint[] {
  const byDay = new Map<string, TikTokCampaignRecord[]>();
  for (const r of rows) {
    const day = (r.statDate || "").slice(0, 10);
    if (!day) continue;
    const list = byDay.get(day) || [];
    list.push(r);
    byDay.set(day, list);
  }

  return Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, dayRows]) => {
      const agg = aggregateCampaignRows(dayRows);
      const { value } = computeRawMetricValue(metricId, agg);
      return { date, value };
    });
}

/**
 * Avalia um indicador considerando a direção correta da métrica (menor é melhor vs maior é melhor),
 * todos os 4 tipos de meta (mínimo, máximo, intervalo ideal e crescimento vs período anterior)
 * e limites mínimos de confiança estatística.
 */
export function evaluateMetricCard(params: {
  metricId: MetricId;
  goal: MetricGoalConfig | null;
  currentRows: TikTokCampaignRecord[];
  previousRows: TikTokCampaignRecord[];
}): EvaluatedMetricCard {
  const def = METRIC_DEFINITIONS[params.metricId];
  const currentAgg = aggregateCampaignRows(params.currentRows);
  const previousAgg = aggregateCampaignRows(params.previousRows);

  const curr = computeRawMetricValue(params.metricId, currentAgg);
  const prev = computeRawMetricValue(params.metricId, previousAgg);
  const dailySeries = buildMetricDailySeries(params.metricId, params.currentRows);

  const currentValue = curr.value;
  const previousValue = prev.value;

  // Tendência vs período anterior
  let trendPct: number | null = null;
  let trendDirection: "up" | "down" | "flat" | "unknown" = "unknown";
  let trendIsFavorable: boolean | null = null;

  if (
    currentValue !== null &&
    previousValue !== null &&
    Math.abs(previousValue) > 0.0001
  ) {
    trendPct = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
    if (Math.abs(trendPct) < 1) {
      trendDirection = "flat";
      trendIsFavorable = null;
    } else if (trendPct > 0) {
      trendDirection = "up";
      trendIsFavorable = def.direction === "higher_is_better";
    } else {
      trendDirection = "down";
      trendIsFavorable = def.direction === "lower_is_better";
    }
  }

  const formattedCurrent = formatMetricValue(currentValue, def.unit);
  const formattedGoal = formatGoalTarget(params.goal, def);

  // Sem dados suficientes
  if (currentValue === null) {
    return {
      definition: def,
      goal: params.goal,
      currentValue: null,
      previousValue,
      formattedCurrent,
      formattedGoal,
      absoluteDiff: null,
      formattedAbsDiff: "—",
      percentDiff: null,
      formattedPctDiff: "—",
      trendPct,
      trendDirection,
      trendIsFavorable,
      status: "insufficient_data",
      statusLabel: "Dados insuficientes",
      statusReason: def.minSampleHint,
      progressPct: 0,
      confidence: "none",
      dailySeries,
    };
  }

  // Sem meta configurada -> exibe valor e tendência neutra
  if (!params.goal || !params.goal.enabled) {
    return {
      definition: def,
      goal: params.goal,
      currentValue,
      previousValue,
      formattedCurrent,
      formattedGoal: "Sem meta",
      absoluteDiff: null,
      formattedAbsDiff: "—",
      percentDiff: null,
      formattedPctDiff: "—",
      trendPct,
      trendDirection,
      trendIsFavorable,
      status: "insufficient_data",
      statusLabel: "Sem meta definida",
      statusReason: "Configure uma meta para acompanhar o cumprimento deste indicador.",
      progressPct: 50,
      confidence: curr.confidence,
      dailySeries,
    };
  }

  const goal = params.goal;
  const tol = Math.max(0.05, Math.min(0.4, (goal.attentionTolerancePct ?? 15) / 100));

  let status: MetricEvalStatus = "on_target";
  let statusLabel = "Dentro da meta";
  let statusReason = "Indicador dentro do objetivo configurado.";
  let absoluteDiff: number | null = null;
  let percentDiff: number | null = null;
  let progressPct = 100;

  if (goal.goalType === "max") {
    const target = goal.targetValue;
    absoluteDiff = currentValue - target;
    percentDiff =
      Math.abs(target) > 0.0001 ? ((currentValue - target) / Math.abs(target)) * 100 : null;

    if (currentValue <= target) {
      // Verifica se está muito próximo do teto (ex.: entre 85% e 100% do limite máximo)
      if (target > 0 && currentValue >= target * (1 - tol * 0.6)) {
        status = "attention";
        statusLabel = "Próximo do limite";
        statusReason = `Valor atual próximo do limite máximo de ${formatMetricValue(target, def.unit)}.`;
      } else {
        status = "on_target";
        statusLabel = "Dentro da meta";
        statusReason = `Abaixo do teto máximo de ${formatMetricValue(target, def.unit)} (favorável).`;
      }
      progressPct =
        target > 0 ? Math.min(100, Math.max(15, (currentValue / target) * 100)) : 100;
    } else if (target > 0 && currentValue <= target * (1 + tol)) {
      status = "attention";
      statusLabel = "Exige atenção";
      statusReason = `Levemente acima do limite máximo (${formatMetricValue(target, def.unit)}).`;
      progressPct = 100;
    } else {
      status = "off_target";
      statusLabel = "Fora da meta";
      statusReason = `Ultrapassou o limite máximo permitido de ${formatMetricValue(target, def.unit)}.`;
      progressPct = 100;
    }
  } else if (goal.goalType === "min") {
    const target = goal.targetValue;
    absoluteDiff = currentValue - target;
    percentDiff =
      Math.abs(target) > 0.0001 ? ((currentValue - target) / Math.abs(target)) * 100 : null;

    if (currentValue >= target) {
      status = "on_target";
      statusLabel = "Dentro da meta";
      statusReason = `Atingiu ou superou o mínimo de ${formatMetricValue(target, def.unit)}.`;
      progressPct = 100;
    } else if (
      target > 0
        ? currentValue >= target * (1 - tol)
        : currentValue >= target - Math.abs(target || 100) * tol
    ) {
      status = "attention";
      statusLabel = "Próximo da meta";
      statusReason = `Falta pouco para alcançar o mínimo de ${formatMetricValue(target, def.unit)}.`;
      progressPct = target > 0 ? Math.min(99, Math.max(5, (currentValue / target) * 100)) : 80;
    } else {
      status = "off_target";
      statusLabel = "Fora da meta";
      statusReason = `Abaixo do objetivo mínimo de ${formatMetricValue(target, def.unit)}.`;
      progressPct = target > 0 ? Math.min(85, Math.max(4, (currentValue / target) * 100)) : 20;
    }
  } else if (goal.goalType === "range") {
    const minVal = Math.min(goal.targetValue, goal.maxValue ?? goal.targetValue);
    const maxVal = Math.max(goal.targetValue, goal.maxValue ?? goal.targetValue);
    const mid = (minVal + maxVal) / 2;

    if (currentValue >= minVal && currentValue <= maxVal) {
      status = "on_target";
      statusLabel = "No intervalo ideal";
      statusReason = `Dentro da faixa ideal (${formatMetricValue(minVal, def.unit)} a ${formatMetricValue(maxVal, def.unit)}).`;
      absoluteDiff = 0;
      percentDiff = 0;
      progressPct = 100;
    } else if (currentValue < minVal) {
      absoluteDiff = currentValue - minVal;
      percentDiff =
        Math.abs(minVal) > 0.0001 ? ((currentValue - minVal) / Math.abs(minVal)) * 100 : null;
      const near = Math.abs(currentValue - minVal) <= Math.max(0.1, Math.abs(mid) * tol);
      status = near ? "attention" : "off_target";
      statusLabel = near ? "Abaixo — Atenção" : "Fora da faixa";
      statusReason = `Abaixo do piso ideal de ${formatMetricValue(minVal, def.unit)}.`;
      progressPct = minVal > 0 ? Math.max(8, Math.min(95, (currentValue / minVal) * 100)) : 40;
    } else {
      absoluteDiff = currentValue - maxVal;
      percentDiff =
        Math.abs(maxVal) > 0.0001 ? ((currentValue - maxVal) / Math.abs(maxVal)) * 100 : null;
      const near = Math.abs(currentValue - maxVal) <= Math.max(0.1, Math.abs(mid) * tol);
      status = near ? "attention" : "off_target";
      statusLabel = near ? "Acima — Atenção" : "Fora da faixa";
      statusReason = `Acima do teto ideal de ${formatMetricValue(maxVal, def.unit)}.`;
      progressPct = 100;
    }
  } else {
    // goalType === "growth_pct" (comparação com período anterior)
    if (previousValue === null || Math.abs(previousValue) < 0.0001 || trendPct === null) {
      return {
        definition: def,
        goal,
        currentValue,
        previousValue,
        formattedCurrent,
        formattedGoal,
        absoluteDiff: null,
        formattedAbsDiff: "—",
        percentDiff: null,
        formattedPctDiff: "—",
        trendPct: null,
        trendDirection: "unknown",
        trendIsFavorable: null,
        status: "insufficient_data",
        statusLabel: "Sem período anterior",
        statusReason:
          "Necessário ter histórico no período anterior equivalente para calcular meta de crescimento.",
        progressPct: 0,
        confidence: "none",
        dailySeries,
      };
    }

    const expectedGrowth = goal.targetValue; // ex.: +15% ou -10%
    // Se a métrica é menor-é-melhor e o usuário colocou +10% (melhora), converte para variação desejada
    const actualImprovement =
      def.direction === "lower_is_better" ? -trendPct : trendPct;
    const targetImprovement =
      def.direction === "lower_is_better" && expectedGrowth < 0
        ? Math.abs(expectedGrowth)
        : expectedGrowth;

    absoluteDiff = currentValue - previousValue;
    percentDiff = trendPct;

    if (actualImprovement >= targetImprovement) {
      status = "on_target";
      statusLabel = "Crescimento atingido";
      statusReason = `Evolução de ${trendPct >= 0 ? "+" : ""}${trendPct.toFixed(1)}% frente ao período anterior.`;
      progressPct = 100;
    } else if (actualImprovement >= targetImprovement - Math.max(5, Math.abs(targetImprovement) * 0.25)) {
      status = "attention";
      statusLabel = "Próximo da meta";
      statusReason = `Evolução de ${trendPct >= 0 ? "+" : ""}${trendPct.toFixed(1)}%, perto da meta de evolução.`;
      progressPct = 75;
    } else {
      status = "off_target";
      statusLabel = "Abaixo da evolução";
      statusReason = `Variação de ${trendPct >= 0 ? "+" : ""}${trendPct.toFixed(1)}% ficou aquém do objetivo.`;
      progressPct = 30;
    }
  }

  // Se amostra for muito pequena para CPA/ROAS/CVR e status for extremo, preserva o status mas sinaliza atenção no motivo
  if (curr.confidence === "low" && (def.id === "cpa" || def.id === "roas" || def.id === "conversion_rate")) {
    statusReason += " (Amostra ainda reduzida — aguarde mais dados antes de agir.)";
  }

  const formattedAbsDiff =
    absoluteDiff === null
      ? "—"
      : `${absoluteDiff > 0 ? "+" : absoluteDiff < 0 ? "-" : ""}${formatMetricValue(
          Math.abs(absoluteDiff),
          def.unit
        )}`;

  const formattedPctDiff =
    percentDiff === null
      ? "—"
      : `${percentDiff > 0 ? "+" : ""}${percentDiff.toFixed(1).replace(".", ",")}%`;

  return {
    definition: def,
    goal,
    currentValue,
    previousValue,
    formattedCurrent,
    formattedGoal,
    absoluteDiff,
    formattedAbsDiff,
    percentDiff,
    formattedPctDiff,
    trendPct,
    trendDirection,
    trendIsFavorable,
    status,
    statusLabel,
    statusReason,
    progressPct,
    confidence: curr.confidence,
    dailySeries,
  };
}

/**
 * Separa registros no período atual e período anterior equivalente (para tendência e meta de crescimento).
 */
export function splitRowsByPeriod(
  allCampaignRows: TikTokCampaignRecord[],
  period: PeriodPreset,
  now: Date = new Date()
): {
  currentRows: TikTokCampaignRecord[];
  previousRows: TikTokCampaignRecord[];
  periodLabel: string;
} {
  if (period === "all") {
    return {
      currentRows: allCampaignRows,
      previousRows: [],
      periodLabel: "Todo o período",
    };
  }

  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let days = 7;
  let periodLabel = "Últimos 7 dias";

  if (period === "today") {
    days = 1;
    periodLabel = "Hoje";
  } else if (period === "7d") {
    days = 7;
    periodLabel = "Últimos 7 dias";
  } else if (period === "30d") {
    days = 30;
    periodLabel = "Últimos 30 dias";
  } else if (period === "month") {
    days = Math.max(1, now.getDate());
    periodLabel = "Mês atual";
  } else {
    days = 30;
    periodLabel = "Últimos 30 dias";
  }

  const currentStart = new Date(end);
  currentStart.setDate(end.getDate() - (days - 1));
  currentStart.setHours(0, 0, 0, 0);

  const prevEnd = new Date(currentStart.getTime() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - (days - 1));
  prevStart.setHours(0, 0, 0, 0);

  const parseDay = (dStr: string): Date | null => {
    const clean = (dStr || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;
    const [y, m, d] = clean.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  };

  const currentRows: TikTokCampaignRecord[] = [];
  const previousRows: TikTokCampaignRecord[] = [];

  for (const r of allCampaignRows) {
    const dt = parseDay(r.statDate);
    if (!dt) continue;
    if (dt >= currentStart && dt <= end) {
      currentRows.push(r);
    } else if (dt >= prevStart && dt <= prevEnd) {
      previousRows.push(r);
    }
  }

  return { currentRows, previousRows, periodLabel };
}

/**
 * Gera o Resumo Visual da Campanha separando rigorosamente saúde financeira de metas de tráfego.
 */
export function evaluateCampaignSummary(
  cards: EvaluatedMetricCard[],
  currentRows: TikTokCampaignRecord[]
): CampaignMetricsSummary {
  const agg = aggregateCampaignRows(currentRows);
  const totalProfit = agg.attributedRevenue - agg.spend;

  let configuredCount = 0;
  let achievedCount = 0;
  let attentionCount = 0;
  let missedCount = 0;
  let insufficientDataCount = 0;

  let favorableTrends = 0;
  let unfavorableTrends = 0;

  for (const card of cards) {
    if (card.goal && card.goal.enabled) {
      configuredCount += 1;
      if (card.status === "on_target") achievedCount += 1;
      else if (card.status === "attention") attentionCount += 1;
      else if (card.status === "off_target") missedCount += 1;
      else insufficientDataCount += 1;
    } else if (card.status === "insufficient_data") {
      insufficientDataCount += 1;
    }

    if (card.trendIsFavorable === true) favorableTrends += 1;
    else if (card.trendIsFavorable === false) unfavorableTrends += 1;
  }

  let overallTrend: CampaignMetricsSummary["overallTrend"] = "insufficient_data";
  let overallTrendLabel = "Sem base comparativa anterior";
  if (favorableTrends > 0 || unfavorableTrends > 0) {
    if (favorableTrends > unfavorableTrends) {
      overallTrend = "improving";
      overallTrendLabel = "Tendência de melhora";
    } else if (unfavorableTrends > favorableTrends) {
      overallTrend = "declining";
      overallTrendLabel = "Tendência de piora";
    } else {
      overallTrend = "stable";
      overallTrendLabel = "Tendência estável";
    }
  }

  let financialHealth: CampaignMetricsSummary["financialHealth"] = "insufficient_data";
  let financialHealthLabel = "Sem dados financeiros suficientes";
  if (agg.spend > 0 || agg.attributedRevenue > 0) {
    if (totalProfit > 0) {
      financialHealth = "profitable";
      financialHealthLabel = `Lucrativa (${formatMetricValue(totalProfit, "currency")})`;
    } else if (Math.abs(totalProfit) < 0.01) {
      financialHealth = "breakeven";
      financialHealthLabel = "No ponto de equilíbrio";
    } else {
      financialHealth = "losing";
      financialHealthLabel = `Resultado negativo (${formatMetricValue(totalProfit, "currency")})`;
    }
  }

  // Regra crítica da Seção 4 & 5: nunca confundir CTR/CPM verde com campanha lucrativa!
  const trafficOnTarget = cards.some(
    (c) => c.definition.category === "traffic" && c.status === "on_target"
  );
  let financialWarning: string | null = null;
  if (financialHealth === "losing" && trafficOnTarget) {
    financialWarning =
      "Atenção: indicadores de tráfego (como CTR/CPM/CPC) estão favoráveis, mas o lucro estimado da campanha está negativo. Avalie oferta, checkout e taxa de conversão antes de escalar.";
  } else if (agg.spend > 0 && agg.conversions === 0) {
    financialWarning =
      "Campanha com investimento ativo sem compras atribuídas no período selecionado. Investigue pixel, UTMs e página de destino.";
  }

  return {
    configuredCount,
    achievedCount,
    attentionCount,
    missedCount,
    insufficientDataCount,
    overallTrend,
    overallTrendLabel,
    financialHealth,
    financialHealthLabel,
    financialWarning,
    totalSpend: agg.spend,
    totalRevenue: agg.attributedRevenue,
    totalProfit,
    totalConversions: agg.conversions,
    totalClicks: agg.clicks,
    totalImpressions: agg.impressions,
  };
}

/**
 * Assistente Inteligente de Análise de Campanhas conectado às metas personalizadas do usuário.
 * - Considera volume de dados e confiabilidade antes de sugerir pausa ou escala.
 * - Identifica grupos de anúncios com maior custo quando CPA estoura a meta.
 * - Distingue métricas de tráfego, conversão e resultado financeiro.
 */
export function generateCampaignAssistantInsights(params: {
  campaignName: string;
  objective: CampaignObjective;
  cards: EvaluatedMetricCard[];
  summary: CampaignMetricsSummary;
  currentRows: TikTokCampaignRecord[];
}): AssistantInsight[] {
  const { objective, cards, summary, currentRows } = params;
  const insights: AssistantInsight[] = [];

  if (currentRows.length === 0 || (summary.totalSpend === 0 && summary.totalImpressions === 0)) {
    return [
      {
        id: "no_data",
        severity: "info",
        category: "general",
        title: "Sem volume de dados no período",
        message:
          "Importe os dados da campanha ou amplie o período de análise para receber diagnósticos baseados nas suas metas.",
      },
    ];
  }

  // Identifica grupo de anúncio com maior custo para enriquecer recomendações
  const adgroupSpend = new Map<string, { spend: number; conversions: number }>();
  for (const r of currentRows) {
    const key = r.adgroupName || "Conjunto Principal";
    const cur = adgroupSpend.get(key) || { spend: 0, conversions: 0 };
    cur.spend += r.spend;
    cur.conversions += r.conversions;
    adgroupSpend.set(key, cur);
  }
  const topCostAdgroup = Array.from(adgroupSpend.entries()).sort(
    (a, b) => b[1].spend - a[1].spend
  )[0];

  const isLowSample =
    summary.totalConversions < 5 && summary.totalSpend < 150 && summary.totalClicks < 80;

  if (isLowSample) {
    insights.push({
      id: "low_sample_guard",
      severity: "info",
      category: "general",
      title: "Amostra estatística ainda reduzida",
      message: `Esta campanha acumulou ${summary.totalConversions} compra(s), ${summary.totalClicks} clique(s) e ${formatMetricValue(summary.totalSpend, "currency")} investidos no período. Evite pausar ou escalar orçamento automaticamente antes de acumular mais dados.`,
    });
  }

  // 1. CPA acima da meta máxima
  const cpaCard = cards.find((c) => c.definition.id === "cpa");
  if (
    cpaCard &&
    cpaCard.currentValue !== null &&
    cpaCard.goal?.enabled &&
    cpaCard.goal.goalType === "max" &&
    cpaCard.status === "off_target"
  ) {
    const deviation =
      cpaCard.percentDiff !== null ? `${Math.abs(cpaCard.percentDiff).toFixed(1)}%` : "";
    const adgroupHint = topCostAdgroup
      ? ` O conjunto "${topCostAdgroup[0]}" concentra ${formatMetricValue(topCostAdgroup[1].spend, "currency")} do gasto.`
      : "";
    insights.push({
      id: "cpa_above_goal",
      severity: "critical",
      metricId: "cpa",
      category: "conversion",
      title: "CPA acima da meta máxima",
      message: `Seu CPA atual está em ${cpaCard.formattedCurrent}, acima da meta máxima de ${formatMetricValue(cpaCard.goal.targetValue, "currency")}${deviation ? ` (desvio de ${deviation})` : ""}. Analise os grupos de anúncios com maior custo antes de considerar uma pausa.${adgroupHint}`,
    });
  }

  // 2. ROAS acima da meta + estabilidade + volume mínimo para avaliar escala
  const roasCard = cards.find((c) => c.definition.id === "roas");
  if (
    roasCard &&
    roasCard.currentValue !== null &&
    roasCard.goal?.enabled &&
    roasCard.status === "on_target"
  ) {
    if (!isLowSample && summary.totalProfit > 0) {
      insights.push({
        id: "roas_scale_candidate",
        severity: "positive",
        metricId: "roas",
        category: "financial",
        title: "ROAS acima da meta com lucro positivo",
        message: `Seu ROAS está em ${roasCard.formattedCurrent} (meta: ${roasCard.formattedGoal}) com lucro estimado de ${formatMetricValue(summary.totalProfit, "currency")}. Considere avaliar um aumento gradual de orçamento (15% a 25%), monitorando o CPA.`,
      });
    } else if (isLowSample) {
      insights.push({
        id: "roas_early_positive",
        severity: "info",
        metricId: "roas",
        category: "financial",
        title: "ROAS inicial promissor (em validação)",
        message: `O ROAS está em ${roasCard.formattedCurrent}, acima da meta (${roasCard.formattedGoal}), mas ainda com volume pequeno (${summary.totalConversions} compra(s)). Mantenha o orçamento estável até validar consistência.`,
      });
    }
  } else if (
    roasCard &&
    roasCard.currentValue !== null &&
    roasCard.goal?.enabled &&
    roasCard.status === "off_target"
  ) {
    insights.push({
      id: "roas_below_goal",
      severity: "critical",
      metricId: "roas",
      category: "financial",
      title: "ROAS abaixo do objetivo configurado",
      message: `O ROAS atual (${roasCard.formattedCurrent}) está abaixo da meta (${roasCard.formattedGoal}). Revise a conversão da página de vendas, ticket médio e criativos com menor retorno antes de aumentar verba.`,
    });
  }

  // 3. Separação entre tráfego bom e resultado financeiro ruim
  if (summary.financialWarning) {
    insights.push({
      id: "traffic_vs_financial",
      severity: "warning",
      category: "financial",
      title: "Diferença entre tráfego e resultado financeiro",
      message: summary.financialWarning,
    });
  }

  // 4. Queda de CTR relevante (fadiga criativa)
  const ctrCard = cards.find((c) => c.definition.id === "ctr");
  if (
    ctrCard &&
    ctrCard.currentValue !== null &&
    ((ctrCard.trendPct !== null && ctrCard.trendPct <= -15) || ctrCard.status === "off_target")
  ) {
    insights.push({
      id: "ctr_creative_check",
      severity: "warning",
      metricId: "ctr",
      category: "traffic",
      title: "Sinal de fadiga ou baixa atratividade no criativo",
      message: `O CTR está em ${ctrCard.formattedCurrent}${ctrCard.goal?.enabled ? ` (meta: ${ctrCard.formattedGoal})` : ""}${ctrCard.trendPct !== null ? ` com variação de ${ctrCard.trendPct.toFixed(1)}% frente ao período anterior` : ""}. Teste novos ganchos nos primeiros 3 segundos do vídeo.`,
    });
  }

  // 5. Campanha de tráfego / reconhecimento dentro das metas de topo de funil
  if (
    (objective === "traffic" || objective === "awareness") &&
    summary.achievedCount > 0 &&
    summary.missedCount === 0
  ) {
    insights.push({
      id: "top_funnel_healthy",
      severity: "positive",
      category: "traffic",
      title: `Objetivo de ${OBJECTIVE_LABELS[objective]} cumprido`,
      message: `As ${summary.achievedCount} meta(s) avaliadas estão dentro do esperado para ${OBJECTIVE_LABELS[objective]}. Lembre-se de acompanhar também as vendas atribuídas caso o foco evolua para conversão.`,
    });
  }

  return insights.slice(0, 5);
}

/**
 * Avalia alertas inteligentes com base nas metas, limites mínimos de dados e toggles do usuário.
 */
export function evaluateMetricAlerts(params: {
  campaignKey: string;
  campaignName: string;
  cards: EvaluatedMetricCard[];
  summary: CampaignMetricsSummary;
  settings: MetricAlertSettings;
}): EvaluatedMetricAlert[] {
  const { campaignKey, campaignName, cards, summary, settings } = params;
  if (!settings.enabled) return [];

  const alerts: EvaluatedMetricAlert[] = [];
  const hasMinSpend = summary.totalSpend >= settings.minSpendForAlerts;
  const hasMinClicks = summary.totalClicks >= settings.minClicksForAlerts;
  const hasMinConversions = summary.totalConversions >= settings.minConversionsForAlerts;

  // 1. Gasto sem compras atribuídas
  if (
    settings.alertOnSpendWithoutPurchases &&
    summary.totalSpend >= settings.spendWithoutPurchasesThreshold &&
    summary.totalConversions === 0
  ) {
    alerts.push({
      dedupeKey: `${campaignKey}:spend_no_purchases`,
      metricId: "conversions",
      alertType: "spend_no_purchases",
      severity: "critical",
      title: `${campaignName}: investimento sem compras atribuídas`,
      message: `A campanha já investiu ${formatMetricValue(summary.totalSpend, "currency")} no período sem registrar nenhuma compra atribuída.`,
    });
  }

  // 2. CPA acima do limite
  const cpaCard = cards.find((c) => c.definition.id === "cpa");
  if (
    settings.alertOnCpaAbove &&
    cpaCard &&
    cpaCard.goal?.enabled &&
    cpaCard.goal.alertEnabled !== false &&
    cpaCard.status === "off_target" &&
    hasMinSpend &&
    hasMinConversions
  ) {
    alerts.push({
      dedupeKey: `${campaignKey}:cpa_above`,
      metricId: "cpa",
      alertType: "cpa_above",
      severity: "critical",
      title: `${campaignName}: CPA acima da meta`,
      message: `CPA atual em ${cpaCard.formattedCurrent}, ultrapassando o limite de ${cpaCard.formattedGoal}.`,
    });
  }

  // 3. ROAS abaixo da meta
  const roasCard = cards.find((c) => c.definition.id === "roas");
  if (
    settings.alertOnRoasBelow &&
    roasCard &&
    roasCard.goal?.enabled &&
    roasCard.goal.alertEnabled !== false &&
    roasCard.status === "off_target" &&
    hasMinSpend
  ) {
    alerts.push({
      dedupeKey: `${campaignKey}:roas_below`,
      metricId: "roas",
      alertType: "roas_below",
      severity: "critical",
      title: `${campaignName}: ROAS abaixo da meta`,
      message: `ROAS atual em ${roasCard.formattedCurrent}, abaixo do mínimo configurado (${roasCard.formattedGoal}).`,
    });
  }

  // 4. Queda significativa de CTR
  const ctrCard = cards.find((c) => c.definition.id === "ctr");
  if (
    settings.alertOnCtrDrop &&
    ctrCard &&
    ctrCard.goal?.alertEnabled !== false &&
    hasMinClicks &&
    ctrCard.trendPct !== null &&
    ctrCard.trendPct <= -Math.abs(settings.ctrDropThresholdPct || 20)
  ) {
    alerts.push({
      dedupeKey: `${campaignKey}:ctr_drop`,
      metricId: "ctr",
      alertType: "ctr_drop",
      severity: "warning",
      title: `${campaignName}: queda acentuada no CTR`,
      message: `O CTR caiu ${Math.abs(ctrCard.trendPct).toFixed(1)}% em relação ao período anterior (atual: ${ctrCard.formattedCurrent}).`,
    });
  }

  // 5. Lucro estimado negativo
  const profitCard = cards.find((c) => c.definition.id === "estimated_profit");
  if (
    settings.alertOnNegativeProfit &&
    (!profitCard?.goal || profitCard.goal.alertEnabled !== false) &&
    hasMinSpend &&
    summary.totalProfit < 0
  ) {
    alerts.push({
      dedupeKey: `${campaignKey}:negative_profit`,
      metricId: "estimated_profit",
      alertType: "negative_profit",
      severity: "critical",
      title: `${campaignName}: lucro estimado negativo`,
      message: `O lucro estimado está em ${formatMetricValue(summary.totalProfit, "currency")} após ${formatMetricValue(summary.totalSpend, "currency")} investidos.`,
    });
  }

  // 6. Meta importante atingida (ROAS ou Lucro Estimado com amostra mínima)
  if (settings.alertOnGoalAchieved && hasMinSpend && hasMinConversions) {
    const heroHit = cards.find(
      (c) =>
        (c.definition.id === "roas" || c.definition.id === "estimated_profit") &&
        c.goal?.enabled &&
        c.goal.alertEnabled !== false &&
        c.status === "on_target" &&
        summary.totalProfit > 0
    );
    if (heroHit) {
      alerts.push({
        dedupeKey: `${campaignKey}:goal_achieved:${heroHit.definition.id}`,
        metricId: heroHit.definition.id,
        alertType: "goal_achieved",
        severity: "positive",
        title: `${campaignName}: meta de ${heroHit.definition.shortLabel} atingida!`,
        message: `${heroHit.definition.label} em ${heroHit.formattedCurrent} (meta: ${heroHit.formattedGoal}).`,
      });
    }
  }

  return alerts;
}

/**
 * Calculadora de CPA máximo e ROAS mínimo integrada às metas da campanha.
 */
export function calculateTargetCpaAndRoas(
  input: CpaRoasCalculatorInput
): CpaRoasCalculatorResult {
  const ticket = Math.max(0, Number(input.averageTicket || 0));
  const cost = Math.max(0, Number(input.productCost || 0));
  const feePct = Math.max(0, Math.min(50, Number(input.gatewayFeePct || 0)));
  const desiredMarginPct = Math.max(
    0,
    Math.min(80, Number(input.desiredProfitMarginPct || 0))
  );

  if (ticket <= 0) {
    return {
      contributionMarginPerSale: 0,
      breakEvenCpa: 0,
      breakEvenRoas: 0,
      targetMaxCpa: 0,
      targetMinRoas: 0,
      feasible: false,
      note: "Informe um ticket médio maior que zero.",
    };
  }

  const gatewayFeeValue = (ticket * feePct) / 100;
  const contributionMargin = ticket - cost - gatewayFeeValue;
  const desiredProfitValue = (ticket * desiredMarginPct) / 100;
  const targetMaxCpa = contributionMargin - desiredProfitValue;

  if (contributionMargin <= 0) {
    return {
      contributionMarginPerSale: Number(contributionMargin.toFixed(2)),
      breakEvenCpa: 0,
      breakEvenRoas: 0,
      targetMaxCpa: 0,
      targetMinRoas: 0,
      feasible: false,
      note: "Custos + taxas superam o ticket médio. Revise preço ou custos antes de rodar tráfego.",
    };
  }

  const breakEvenCpa = contributionMargin;
  const breakEvenRoas = ticket / breakEvenCpa;

  if (targetMaxCpa <= 0) {
    return {
      contributionMarginPerSale: Number(contributionMargin.toFixed(2)),
      breakEvenCpa: Number(breakEvenCpa.toFixed(2)),
      breakEvenRoas: Number(breakEvenRoas.toFixed(2)),
      targetMaxCpa: 0,
      targetMinRoas: 0,
      feasible: false,
      note: `A margem de lucro desejada (${desiredMarginPct}%) excede a margem de contribuição disponível (${((contributionMargin / ticket) * 100).toFixed(1)}%).`,
    };
  }

  const targetMinRoas = ticket / targetMaxCpa;

  return {
    contributionMarginPerSale: Number(contributionMargin.toFixed(2)),
    breakEvenCpa: Number(breakEvenCpa.toFixed(2)),
    breakEvenRoas: Number(breakEvenRoas.toFixed(2)),
    targetMaxCpa: Number(targetMaxCpa.toFixed(2)),
    targetMinRoas: Number(targetMinRoas.toFixed(2)),
    feasible: true,
    note: `Para manter ${desiredMarginPct}% de margem líquida, mantenha o CPA até ${formatMetricValue(targetMaxCpa, "currency")} e o ROAS acima de ${targetMinRoas.toFixed(2)}x.`,
  };
}
