import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  createManualExpense,
  deleteManualExpense,
  type ExpenseCategory,
} from "@/lib/db";

const createExpenseSchema = z.object({
  category: z
    .enum(["META_ADS", "TIKTOK_ADS", "OTHER_ADS", "TOOLS", "OTHER"])
    .default("OTHER"),
  gateway: z.enum(["ALL", "OMEGAPAY", "NEXUS"]).default("ALL"),
  dashboardId: z.string().min(1).max(60).optional(),
  campaignName: z.string().max(160).optional().nullable(),
  title: z.string().min(1, "Informe uma descrição para a despesa.").max(120),
  amount: z.number().positive("O valor da despesa deve ser maior que zero."),
  expenseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use YYYY-MM-DD)."),
  notes: z.string().max(400).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const raw = await request.json();

    let amountNum: number;
    if (typeof raw?.amount === "number") {
      amountNum = raw.amount;
    } else {
      const cleanStr = String(raw?.amount ?? "")
        .trim()
        .replace(/\s/g, "")
        .replace(",", ".");
      amountNum = Number(cleanStr);
    }

    const defaultTitle =
      raw?.category === "META_ADS"
        ? "Meta Ads"
        : raw?.category === "TIKTOK_ADS"
          ? "TikTok Ads"
          : raw?.category === "OTHER_ADS"
            ? "Outros Anúncios"
            : raw?.category === "TOOLS"
              ? "Ferramentas & SaaS"
              : "Despesa";

    const title =
      typeof raw?.title === "string" && raw.title.trim().length > 0
        ? raw.title.trim()
        : defaultTitle;

    let dateStr =
      typeof raw?.expenseDate === "string"
        ? raw.expenseDate.trim().slice(0, 10)
        : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const d = new Date();
      dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    const parsed = createExpenseSchema.safeParse({
      ...raw,
      title,
      amount: amountNum,
      expenseDate: dateStr,
      notes: typeof raw?.notes === "string" ? raw.notes.trim() : null,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const expense = await createManualExpense({
      userId: user.id,
      category: parsed.data.category as ExpenseCategory,
      gateway: parsed.data.gateway,
      dashboardId: parsed.data.dashboardId,
      campaignName: parsed.data.campaignName ?? null,
      title: parsed.data.title,
      amount: parsed.data.amount,
      expenseDate: parsed.data.expenseDate,
      notes: parsed.data.notes ?? null,
    });

    return NextResponse.json({ ok: true, expense }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao registrar despesa manual.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "ID da despesa não informado." },
      { status: 400 }
    );
  }

  const deleted = await deleteManualExpense(id, user.id);
  if (!deleted) {
    return NextResponse.json(
      { error: "Despesa não encontrada ou sem permissão." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
