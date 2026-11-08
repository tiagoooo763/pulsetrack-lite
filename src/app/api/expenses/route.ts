import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import {
  createManualExpense,
  deleteManualExpense,
  type ExpenseCategory,
} from "@/lib/db";

const createExpenseSchema = z.object({
  category: z.enum(["META_ADS", "TIKTOK_ADS", "OTHER_ADS", "TOOLS", "OTHER"]),
  title: z.string().min(2, "Informe uma descrição para a despesa.").max(120),
  amount: z.number().positive("O valor da despesa deve ser maior que zero."),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use YYYY-MM-DD)."),
  notes: z.string().max(400).optional().nullable(),
});

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const parsed = createExpenseSchema.safeParse({
      ...raw,
      amount: Number(raw?.amount),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const expense = await createManualExpense({
      category: parsed.data.category as ExpenseCategory,
      title: parsed.data.title,
      amount: parsed.data.amount,
      expenseDate: parsed.data.expenseDate,
      notes: parsed.data.notes ?? null,
    });

    return NextResponse.json({ ok: true, expense }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao registrar despesa manual." },
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
    return NextResponse.json(
      { error: "ID da despesa é obrigatório." },
      { status: 400 }
    );
  }

  await deleteManualExpense(id);
  return NextResponse.json({ ok: true });
}
