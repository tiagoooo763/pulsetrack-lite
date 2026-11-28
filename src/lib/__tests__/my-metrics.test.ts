import fs from "fs";
import path from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  BUILT_IN_METRIC_TEMPLATES,
  calculateTargetCpaAndRoas,
  DEFAULT_ALERT_SETTINGS,
  evaluateCampaignSummary,
  evaluateMetricAlerts,
  evaluateMetricCard,
  generateCampaignAssistantInsights,
  splitRowsByPeriod,
  type MetricGoalConfig,
} from "@/lib/my-metrics";
import {
  createUserMetricTemplate,
  deleteCampaignMetricConfig,
  deleteUserMetricTemplate,
  listCampaignMetricConfigs,
  listRecentMetricAlertLogs,
  listUserMetricTemplates,
  recordMetricAlertWithCooldown,
  upsertCampaignMetricConfig,
  type TikTokCampaignRecord,
} from "@/lib/db";

const TEST_DB_REL = "./data/test-my-metrics.db";
const TEST_DB_ABS = path.resolve(process.cwd(), "data/test-my-metrics.db");

const USER_A = "aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb";

function makeCampaignRow(overrides: Partial<TikTokCampaignRecord>): TikTokCampaignRecord {
  const now = new Date().toISOString();
  return {
    id: overrides.id || `row_${Math.random().toString(36).slice(2)}`,
    dashboardId: overrides.dashboardId || "tiktok",
    adAccount: overrides.adAccount || "Conta Principal TikTok",
    campaignName: overrides.campaignName || "Campanha Escala A",
    adgroupName: overrides.adgroupName || "Conjunto Aberto 18-45",
    adName: overrides.adName || "Criativo 01",
    productName: overrides.productName || "Produto A",
    utmSource: "tiktok",
    utmMedium: "cpc",
    utmCampaign: "escala_a",
    utmContent: "v1",
    statDate: overrides.statDate || "2026-11-26",
    spend: overrides.spend ?? 200,
    impressions: overrides.impressions ?? 10000,
    clicks: overrides.clicks ?? 250,
    conversions: overrides.conversions ?? 8,
    attributedRevenue: overrides.attributedRevenue ?? 800,
    status: overrides.status || "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };
}

describe("Dashfy — Minhas Métricas: Metas, Interpretação, Modelos, Assistente, Alertas e Isolamento", () => {
  beforeAll(() => {
    try {
      if (fs.existsSync(TEST_DB_ABS)) fs.unlinkSync(TEST_DB_ABS);
    } catch {}
    process.env.DATABASE_URL = `file:${TEST_DB_REL}`;
    delete process.env.VERCEL;
  });

  afterAll(() => {
    try {
      if (fs.existsSync(TEST_DB_ABS)) fs.unlinkSync(TEST_DB_ABS);
    } catch {}
  });

  it("1. Avalia direção correta para metas máximas (CPA/CPC/CPM), mínimas (ROAS/CTR/Lucro), intervalo e crescimento", () => {
    // CPA = 200 / 8 = R$ 25,00 vs meta máx. R$ 20,00 -> off_target (+25%)
    const current = [makeCampaignRow({ spend: 200, impressions: 10000, clicks: 250, conversions: 8, attributedRevenue: 800 })];
    const previous = [makeCampaignRow({ statDate: "2026-11-18", spend: 200, impressions: 10000, clicks: 200, conversions: 6, attributedRevenue: 600 })];

    const cpaOff = evaluateMetricCard({
      metricId: "cpa",
      goal: { metricId: "cpa", enabled: true, goalType: "max", targetValue: 20 },
      currentRows: current,
      previousRows: previous,
    });
    expect(cpaOff.currentValue).toBeCloseTo(25, 2);
    expect(cpaOff.status).toBe("off_target");
    expect(cpaOff.percentDiff).toBeCloseTo(25, 1);
    expect(cpaOff.trendIsFavorable).toBe(true); // caiu de R$ 33,33 para R$ 25,00 (favorável)

    // CPA favorável: R$ 15,00 vs meta máx. R$ 20,00 -> on_target
    const cpaOk = evaluateMetricCard({
      metricId: "cpa",
      goal: { metricId: "cpa", enabled: true, goalType: "max", targetValue: 20 },
      currentRows: [makeCampaignRow({ spend: 150, conversions: 10 })],
      previousRows: [],
    });
    expect(cpaOk.currentValue).toBeCloseTo(15, 2);
    expect(cpaOk.status).toBe("on_target");

    // ROAS = 800 / 200 = 4.0x vs meta mín. 3.0x -> on_target
    const roasOk = evaluateMetricCard({
      metricId: "roas",
      goal: { metricId: "roas", enabled: true, goalType: "min", targetValue: 3 },
      currentRows: current,
      previousRows: previous,
    });
    expect(roasOk.currentValue).toBeCloseTo(4, 2);
    expect(roasOk.status).toBe("on_target");
    expect(roasOk.trendIsFavorable).toBe(true); // subiu de 3.0x para 4.0x

    // CTR = 250 / 10000 = 2.5% dentro do intervalo ideal 2% a 4% -> on_target
    const ctrRange = evaluateMetricCard({
      metricId: "ctr",
      goal: { metricId: "ctr", enabled: true, goalType: "range", targetValue: 2, maxValue: 4 },
      currentRows: current,
      previousRows: previous,
    });
    expect(ctrRange.currentValue).toBeCloseTo(2.5, 2);
    expect(ctrRange.status).toBe("on_target");

    // Meta de crescimento em relação ao período anterior: ROAS subiu +33.3% vs meta +20% -> on_target
    const roasGrowth = evaluateMetricCard({
      metricId: "roas",
      goal: { metricId: "roas", enabled: true, goalType: "growth_pct", targetValue: 20 },
      currentRows: current,
      previousRows: previous,
    });
    expect(roasGrowth.status).toBe("on_target");
  });

  it("2. Trata valores zerados, métricas sem dados (Frequência/CPA sem compras) e não confunde CTR bom com lucratividade", () => {
    // Campanha sem nenhum dado -> insufficient_data
    const emptyCpa = evaluateMetricCard({
      metricId: "cpa",
      goal: { metricId: "cpa", enabled: true, goalType: "max", targetValue: 20 },
      currentRows: [],
      previousRows: [],
    });
    expect(emptyCpa.status).toBe("insufficient_data");
    expect(emptyCpa.currentValue).toBeNull();

    // Frequência sem reach da API -> insufficient_data (nunca inventa número)
    const rowTrafficGoodProfitBad = [
      makeCampaignRow({
        spend: 300,
        impressions: 20000,
        clicks: 600, // CTR = 3% (verde!)
        conversions: 0, // zero compras!
        attributedRevenue: 0, // lucro = -R$ 300!
      }),
    ];

    const freq = evaluateMetricCard({
      metricId: "frequency",
      goal: { metricId: "frequency", enabled: true, goalType: "range", targetValue: 1, maxValue: 2.5 },
      currentRows: rowTrafficGoodProfitBad,
      previousRows: [],
    });
    expect(freq.status).toBe("insufficient_data");

    const ctr = evaluateMetricCard({
      metricId: "ctr",
      goal: { metricId: "ctr", enabled: true, goalType: "min", targetValue: 2 },
      currentRows: rowTrafficGoodProfitBad,
      previousRows: [],
    });
    const cpaZero = evaluateMetricCard({
      metricId: "cpa",
      goal: { metricId: "cpa", enabled: true, goalType: "max", targetValue: 20 },
      currentRows: rowTrafficGoodProfitBad,
      previousRows: [],
    });
    const profit = evaluateMetricCard({
      metricId: "estimated_profit",
      goal: { metricId: "estimated_profit", enabled: true, goalType: "min", targetValue: 300 },
      currentRows: rowTrafficGoodProfitBad,
      previousRows: [],
    });

    expect(ctr.status).toBe("on_target");
    expect(cpaZero.status).toBe("insufficient_data");
    expect(profit.status).toBe("off_target");

    const summary = evaluateCampaignSummary([ctr, cpaZero, profit], rowTrafficGoodProfitBad);
    expect(summary.financialHealth).toBe("losing");
    expect(summary.financialWarning).toBeTruthy();
    expect(summary.financialWarning).toContain("lucro estimado");
  });

  it("3. Assistente inteligente respeita amostra pequena, aponta desvio de CPA e integra calculadora CPA/ROAS", () => {
    // Amostra pequena: apenas 1 compra e R$ 25 investidos -> não recomenda escalar automaticamente
    const tinyRows = [
      makeCampaignRow({ spend: 25, impressions: 1200, clicks: 30, conversions: 1, attributedRevenue: 120 }),
    ];
    const tinyRoas = evaluateMetricCard({
      metricId: "roas",
      goal: { metricId: "roas", enabled: true, goalType: "min", targetValue: 3 },
      currentRows: tinyRows,
      previousRows: [],
    });
    const tinySummary = evaluateCampaignSummary([tinyRoas], tinyRows);
    const tinyInsights = generateCampaignAssistantInsights({
      campaignName: "Campanha Teste",
      objective: "conversion",
      cards: [tinyRoas],
      summary: tinySummary,
      currentRows: tinyRows,
    });
    expect(tinyInsights.some((i) => i.id === "low_sample_guard")).toBe(true);
    expect(tinyInsights.some((i) => i.id === "roas_scale_candidate")).toBe(false);

    // CPA = R$ 25 vs meta R$ 20 (desvio 25%) com conjunto mais caro identificado
    const heavyRows = [
      makeCampaignRow({ adgroupName: "Conjunto Caro A", spend: 175, conversions: 5, attributedRevenue: 400 }),
      makeCampaignRow({ adgroupName: "Conjunto B", spend: 75, conversions: 5, attributedRevenue: 400 }),
    ];
    const cpaCard = evaluateMetricCard({
      metricId: "cpa",
      goal: { metricId: "cpa", enabled: true, goalType: "max", targetValue: 20 },
      currentRows: heavyRows,
      previousRows: [],
    });
    const heavySummary = evaluateCampaignSummary([cpaCard], heavyRows);
    const heavyInsights = generateCampaignAssistantInsights({
      campaignName: "Campanha Escala",
      objective: "conversion",
      cards: [cpaCard],
      summary: heavySummary,
      currentRows: heavyRows,
    });
    const cpaAdvice = heavyInsights.find((i) => i.id === "cpa_above_goal");
    expect(cpaAdvice).toBeDefined();
    expect(cpaAdvice?.message).toContain("Conjunto Caro A");
    expect(cpaAdvice?.message).toContain("25.0%");

    // Calculadora de CPA e ROAS
    const calc = calculateTargetCpaAndRoas({
      averageTicket: 200,
      productCost: 40,
      gatewayFeePct: 5, // R$ 10 -> margem contrib = R$ 150
      desiredProfitMarginPct: 25, // R$ 50 lucro desejado -> CPA máx = R$ 100, ROAS mín = 2.00x
    });
    expect(calc.feasible).toBe(true);
    expect(calc.breakEvenCpa).toBe(150);
    expect(calc.targetMaxCpa).toBe(100);
    expect(calc.targetMinRoas).toBe(2);
  });

  it("4. Separa períodos corretamente (7d vs 7d anterior) e avalia todos os 6 gatilhos de alertas inteligentes", () => {
    const now = new Date(2026, 10, 28, 12, 0, 0); // 2026-11-28
    const rows = [
      makeCampaignRow({ statDate: "2026-11-26", spend: 180, impressions: 10000, clicks: 120, conversions: 0, attributedRevenue: 0 }),
      makeCampaignRow({ statDate: "2026-11-18", spend: 180, impressions: 10000, clicks: 300, conversions: 6, attributedRevenue: 600 }),
    ];

    const split7 = splitRowsByPeriod(rows, "7d", now);
    expect(split7.currentRows).toHaveLength(1);
    expect(split7.previousRows).toHaveLength(1);

    const ctrCard = evaluateMetricCard({
      metricId: "ctr",
      goal: { metricId: "ctr", enabled: true, goalType: "min", targetValue: 2 },
      currentRows: split7.currentRows,
      previousRows: split7.previousRows,
    });
    const roasCard = evaluateMetricCard({
      metricId: "roas",
      goal: { metricId: "roas", enabled: true, goalType: "min", targetValue: 3 },
      currentRows: split7.currentRows,
      previousRows: split7.previousRows,
    });
    const summary = evaluateCampaignSummary([ctrCard, roasCard], split7.currentRows);
    const alerts = evaluateMetricAlerts({
      campaignKey: "acc::camp_1",
      campaignName: "Campanha 1",
      cards: [ctrCard, roasCard],
      summary,
      settings: { ...DEFAULT_ALERT_SETTINGS },
    });

    const types = alerts.map((a) => a.alertType);
    expect(types).toContain("spend_no_purchases");
    expect(types).toContain("roas_below");
    expect(types).toContain("ctr_drop");
    expect(types).toContain("negative_profit");
  });

  it("5. Persiste preferências, múltiplas visualizações, modelos, cooldown de alertas e isola 100% entre Usuário A e Usuário B", async () => {
    expect(BUILT_IN_METRIC_TEMPLATES).toHaveLength(5);

    const goalsA: Record<string, MetricGoalConfig> = {
      cpa: { metricId: "cpa", enabled: true, goalType: "max", targetValue: 18 },
      roas: { metricId: "roas", enabled: true, goalType: "min", targetValue: 3.5 },
    };

    // Usuário A salva duas visualizações diferentes para a mesma campanha
    const view1 = await upsertCampaignMetricConfig({
      userId: USER_A,
      dashboardId: "tiktok",
      adAccount: "Conta A",
      campaignKey: "Conta A::Campanha Black",
      campaignName: "Campanha Black",
      viewName: "Padrão",
      isActive: true,
      objective: "conversion",
      periodPreset: "7d",
      selectedMetrics: ["cpa", "roas", "estimated_profit"],
      goals: goalsA,
      alertSettings: { ...DEFAULT_ALERT_SETTINGS },
    });
    const view2 = await upsertCampaignMetricConfig({
      userId: USER_A,
      dashboardId: "tiktok",
      adAccount: "Conta A",
      campaignKey: "Conta A::Campanha Black",
      campaignName: "Campanha Black",
      viewName: "Criativos",
      isActive: true,
      objective: "creatives",
      periodPreset: "30d",
      selectedMetrics: ["ctr", "cpc", "cpm"],
      goals: {},
      alertSettings: { ...DEFAULT_ALERT_SETTINGS },
    });

    const configsA = await listCampaignMetricConfigs(USER_A, "tiktok");
    expect(configsA).toHaveLength(2);
    expect(configsA.find((c) => c.id === view2.id)?.isActive).toBe(true);
    expect(configsA.find((c) => c.id === view1.id)?.isActive).toBe(false);

    // Usuário B não vê nenhuma configuração do Usuário A e não pode excluí-la
    expect(await listCampaignMetricConfigs(USER_B, "tiktok")).toHaveLength(0);
    expect(await deleteCampaignMetricConfig(USER_B, view1.id)).toBe(false);

    // Modelo personalizado do Usuário A isolado do Usuário B
    const tplA = await createUserMetricTemplate({
      userId: USER_A,
      name: "Escala High Ticket",
      description: "Preset próprio",
      objective: "financial",
      selectedMetrics: ["roas", "estimated_profit", "cpa"],
      goals: goalsA,
      alertSettings: { ...DEFAULT_ALERT_SETTINGS },
    });
    expect(await listUserMetricTemplates(USER_A)).toHaveLength(1);
    expect(await listUserMetricTemplates(USER_B)).toHaveLength(0);
    expect(await deleteUserMetricTemplate(USER_B, tplA.id)).toBe(false);
    expect(await deleteUserMetricTemplate(USER_A, tplA.id)).toBe(true);

    // Cooldown impede alerta duplicado dentro da janela configurada
    const firstAlert = await recordMetricAlertWithCooldown({
      userId: USER_A,
      dashboardId: "tiktok",
      campaignKey: "Conta A::Campanha Black",
      metricId: "cpa",
      alertType: "cpa_above",
      dedupeKey: "Conta A::Campanha Black:cpa_above",
      severity: "critical",
      title: "CPA acima da meta",
      message: "CPA R$ 25 > R$ 18",
      cooldownHours: 12,
    });
    expect(firstAlert.created).toBe(true);

    const dupAlert = await recordMetricAlertWithCooldown({
      userId: USER_A,
      dashboardId: "tiktok",
      campaignKey: "Conta A::Campanha Black",
      metricId: "cpa",
      alertType: "cpa_above",
      dedupeKey: "Conta A::Campanha Black:cpa_above",
      severity: "critical",
      title: "CPA acima da meta",
      message: "CPA R$ 25 > R$ 18",
      cooldownHours: 12,
    });
    expect(dupAlert.created).toBe(false);
    expect(await listRecentMetricAlertLogs(USER_A, "tiktok")).toHaveLength(1);
    expect(await listRecentMetricAlertLogs(USER_B, "tiktok")).toHaveLength(0);
  });
});
