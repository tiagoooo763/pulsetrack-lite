import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  deleteCampaignMetricConfig,
  listCampaignMetricConfigs,
  upsertCampaignMetricConfig,
} from "@/lib/db";
import {
  ALL_METRIC_IDS,
  DEFAULT_ALERT_SETTINGS,
  getDefaultMetricSetup,
  type MetricId,
} from "@/lib/my-metrics";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

const VALID_METRICS_SET = new Set<string>(ALL_METRIC_IDS);

function sanitizeSelectedMetrics(raw: unknown): MetricId[] {
  if (!Array.isArray(raw)) return getDefaultMetricSetup().selectedMetrics;
  const deduped: MetricId[] = [];
  for (const item of raw) {
    if (
      typeof item === "string" &&
      VALID_METRICS_SET.has(item) &&
      !deduped.includes(item as MetricId)
    ) {
      deduped.push(item as MetricId);
    }
  }
  return deduped.length > 0 ? deduped : getDefaultMetricSetup().selectedMetrics;
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado." },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const dashboardId = request.nextUrl.searchParams.get("dashboardId") || undefined;
  const configs = await listCampaignMetricConfigs(user.id, dashboardId);

  return NextResponse.json(
    { ok: true, configs },
    { headers: NO_STORE_HEADERS }
  );
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado." },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "save";
    const dashboardId = String(body.dashboardId || "tiktok").trim().slice(0, 60);

    // Aplicar modelo a múltiplas campanhas (protegendo configurações existentes quando overwriteExisting = false)
    if (action === "bulk_apply") {
      const targets = Array.isArray(body.targets)
        ? (body.targets as Array<{
            campaignKey?: string;
            campaignName?: string;
            adAccount?: string;
          }>)
        : [];
      const overwriteExisting = Boolean(body.overwriteExisting);
      const selectedMetrics = sanitizeSelectedMetrics(body.selectedMetrics);
      const goals =
        body.goals && typeof body.goals === "object"
          ? (body.goals as Record<string, unknown>)
          : {};
      const alertSettings =
        body.alertSettings && typeof body.alertSettings === "object"
          ? (body.alertSettings as Record<string, unknown>)
          : { ...DEFAULT_ALERT_SETTINGS };
      const objective = String(body.objective || "conversion");
      const periodPreset = String(body.periodPreset || "30d");

      if (targets.length === 0) {
        return NextResponse.json(
          { ok: false, error: "Selecione ao menos uma campanha para aplicar o modelo." },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      const existingAll = await listCampaignMetricConfigs(user.id, dashboardId);
      const existingKeys = new Set(existingAll.map((c) => c.campaignKey));

      let appliedCount = 0;
      let skippedCount = 0;

      for (const target of targets.slice(0, 50)) {
        const key = String(target.campaignKey || "").trim();
        if (!key) continue;
        if (!overwriteExisting && existingKeys.has(key)) {
          skippedCount += 1;
          continue;
        }
        await upsertCampaignMetricConfig({
          userId: user.id,
          dashboardId,
          adAccount: String(target.adAccount || ""),
          campaignKey: key,
          campaignName: String(target.campaignName || key),
          viewName: "Padrão",
          isActive: true,
          objective,
          periodPreset,
          selectedMetrics,
          goals,
          alertSettings,
        });
        appliedCount += 1;
      }

      const configs = await listCampaignMetricConfigs(user.id, dashboardId);
      return NextResponse.json(
        {
          ok: true,
          appliedCount,
          skippedCount,
          configs,
          message:
            skippedCount > 0
              ? `Modelo aplicado em ${appliedCount} campanha(s) (${skippedCount} preservada(s) sem sobrescrever).`
              : `Modelo aplicado com sucesso em ${appliedCount} campanha(s).`,
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    // Restaurar configurações padrão de uma campanha
    if (action === "reset_default") {
      const campaignKey = String(body.campaignKey || "__DEFAULT__").trim();
      const campaignName = String(body.campaignName || "Padrão da Operação").trim();
      const adAccount = String(body.adAccount || "").trim();
      const viewName = String(body.viewName || "Padrão").trim();
      const defaults = getDefaultMetricSetup();

      const saved = await upsertCampaignMetricConfig({
        userId: user.id,
        dashboardId,
        adAccount,
        campaignKey,
        campaignName,
        viewName,
        isActive: true,
        objective: defaults.objective,
        periodPreset: "30d",
        selectedMetrics: defaults.selectedMetrics,
        goals: defaults.goals as unknown as Record<string, unknown>,
        alertSettings: defaults.alertSettings as unknown as Record<string, unknown>,
      });

      const configs = await listCampaignMetricConfigs(user.id, dashboardId);
      return NextResponse.json(
        {
          ok: true,
          config: saved,
          configs,
          message: "Configurações restauradas para o padrão de conversão.",
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    // Salvar preferência/visualização individual de campanha ou padrão da operação
    const campaignKey = String(body.campaignKey || "__DEFAULT__").trim();
    if (!campaignKey) {
      return NextResponse.json(
        { ok: false, error: "Identificador da campanha inválido." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const saved = await upsertCampaignMetricConfig({
      userId: user.id,
      dashboardId,
      adAccount: String(body.adAccount || ""),
      campaignKey,
      campaignName: String(body.campaignName || campaignKey),
      viewName: String(body.viewName || "Padrão"),
      isActive: body.isActive !== false,
      objective: String(body.objective || "conversion"),
      periodPreset: String(body.periodPreset || "30d"),
      selectedMetrics: sanitizeSelectedMetrics(body.selectedMetrics),
      goals:
        body.goals && typeof body.goals === "object"
          ? (body.goals as Record<string, unknown>)
          : {},
      alertSettings:
        body.alertSettings && typeof body.alertSettings === "object"
          ? (body.alertSettings as Record<string, unknown>)
          : { ...DEFAULT_ALERT_SETTINGS },
    });

    const configs = await listCampaignMetricConfigs(user.id, dashboardId);
    return NextResponse.json(
      {
        ok: true,
        config: saved,
        configs,
        message: "Preferências e metas salvas na sua conta.",
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Erro ao salvar configurações de métricas." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado." },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const id = request.nextUrl.searchParams.get("id")?.trim() || "";
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "ID da visualização é obrigatório." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const removed = await deleteCampaignMetricConfig(user.id, id);
  if (!removed) {
    return NextResponse.json(
      { ok: false, error: "Visualização não encontrada." },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
