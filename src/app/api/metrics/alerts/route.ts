import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  listRecentMetricAlertLogs,
  recordMetricAlertWithCooldown,
} from "@/lib/db";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado." },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const dashboardId = request.nextUrl.searchParams.get("dashboardId") || undefined;
  const logs = await listRecentMetricAlertLogs(user.id, dashboardId, 30);

  return NextResponse.json({ ok: true, logs }, { headers: NO_STORE_HEADERS });
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
    const dashboardId = String(body.dashboardId || "tiktok").trim().slice(0, 60);
    const cooldownHours = Number(body.cooldownHours ?? 12);
    const items = Array.isArray(body.alerts)
      ? (body.alerts as Array<{
          campaignKey?: string;
          metricId?: string;
          alertType?: string;
          dedupeKey?: string;
          severity?: "critical" | "warning" | "positive";
          title?: string;
          message?: string;
        }>)
      : [];

    let createdCount = 0;
    for (const item of items.slice(0, 15)) {
      if (!item.dedupeKey || !item.title || !item.message) continue;
      const sev =
        item.severity === "critical" || item.severity === "positive"
          ? item.severity
          : "warning";
      const res = await recordMetricAlertWithCooldown({
        userId: user.id,
        dashboardId,
        campaignKey: String(item.campaignKey || "__DEFAULT__"),
        metricId: String(item.metricId || "campaign"),
        alertType: String(item.alertType || "custom"),
        dedupeKey: String(item.dedupeKey),
        severity: sev,
        title: String(item.title),
        message: String(item.message),
        cooldownHours: Number.isFinite(cooldownHours) ? cooldownHours : 12,
      });
      if (res.created) createdCount += 1;
    }

    const logs = await listRecentMetricAlertLogs(user.id, dashboardId, 30);
    return NextResponse.json(
      { ok: true, createdCount, logs },
      { headers: NO_STORE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Erro ao registrar alertas de métricas." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
