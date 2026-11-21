import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import {
  createAutomationRule,
  deleteAutomationRule,
  listAutomationRules,
  toggleAutomationRule,
} from "@/lib/db";

const createRuleSchema = z.object({
  dashboardId: z.string().min(1).max(60).default("tiktok"),
  name: z.string().min(2, "Informe um nome para a regra.").max(120),
  metric: z.enum(["ROAS", "CPA", "CPC", "SPEND"]),
  operator: z.enum(["LT", "GT"]),
  threshold: z.number().min(0),
  actionLabel: z.string().min(2).max(120).default("Sinalizar alerta na campanha"),
});

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const rules = await listAutomationRules();
  return NextResponse.json({ ok: true, rules });
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const raw = (await request.json()) as Record<string, unknown>;
    const threshold =
      typeof raw.threshold === "number"
        ? raw.threshold
        : Number(String(raw.threshold ?? "0").replace(",", "."));

    const parsed = createRuleSchema.safeParse({
      dashboardId: typeof raw.dashboardId === "string" && raw.dashboardId.trim() ? raw.dashboardId.trim() : "tiktok",
      name: String(raw.name ?? "").trim(),
      metric: raw.metric,
      operator: raw.operator,
      threshold,
      actionLabel: String(raw.actionLabel || "Sinalizar alerta na campanha").trim(),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados de regra inválidos." },
        { status: 400 }
      );
    }

    const rule = await createAutomationRule(parsed.data);
    return NextResponse.json({ ok: true, rule }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao criar regra de monitoramento." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { id?: string; enabled?: boolean };
    if (!body.id) {
      return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    }
    await toggleAutomationRule(body.id, Boolean(body.enabled));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Erro ao atualizar regra." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
  }
  await deleteAutomationRule(id);
  return NextResponse.json({ ok: true });
}
