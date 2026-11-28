import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  createUserMetricTemplate,
  deleteUserMetricTemplate,
  listUserMetricTemplates,
} from "@/lib/db";
import {
  ALL_METRIC_IDS,
  DEFAULT_ALERT_SETTINGS,
  type MetricId,
} from "@/lib/my-metrics";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

const VALID_METRICS_SET = new Set<string>(ALL_METRIC_IDS);

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado." },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const templates = await listUserMetricTemplates(user.id);
  return NextResponse.json(
    { ok: true, templates },
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
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Informe um nome com ao menos 2 caracteres para o modelo." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const rawSelected = Array.isArray(body.selectedMetrics)
      ? body.selectedMetrics
      : [];
    const selectedMetrics = rawSelected.filter(
      (m): m is MetricId => typeof m === "string" && VALID_METRICS_SET.has(m)
    );
    if (selectedMetrics.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Selecione ao menos uma métrica para salvar o modelo." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const template = await createUserMetricTemplate({
      userId: user.id,
      name,
      description:
        typeof body.description === "string" ? body.description.trim() : "",
      objective: String(body.objective || "conversion"),
      selectedMetrics,
      goals:
        body.goals && typeof body.goals === "object"
          ? (body.goals as Record<string, unknown>)
          : {},
      alertSettings:
        body.alertSettings && typeof body.alertSettings === "object"
          ? (body.alertSettings as Record<string, unknown>)
          : { ...DEFAULT_ALERT_SETTINGS },
    });

    const templates = await listUserMetricTemplates(user.id);
    return NextResponse.json(
      {
        ok: true,
        template,
        templates,
        message: `Modelo "${template.name}" salvo na sua conta.`,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Erro ao criar modelo personalizado." },
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
      { ok: false, error: "ID do modelo é obrigatório." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const deleted = await deleteUserMetricTemplate(user.id, id);
  if (!deleted) {
    return NextResponse.json(
      { ok: false, error: "Modelo não encontrado." },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
