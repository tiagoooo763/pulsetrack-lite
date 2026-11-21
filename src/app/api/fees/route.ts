import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import {
  createCustomFee,
  deleteCustomFee,
  listCustomFees,
  type DashboardOperationId,
  type FeeCategory,
  type FeeType,
} from "@/lib/db";

const createFeeSchema = z.object({
  dashboardId: z.enum(["tiktok", "omegapay"]).default("omegapay"),
  name: z.string().min(1, "Informe o nome da taxa.").max(120),
  category: z.enum(["GATEWAY", "TAX", "PLATFORM", "OTHER"]).default("GATEWAY"),
  feeType: z.enum(["FIXED", "PERCENTAGE"]).default("FIXED"),
  value: z.number().positive("O valor da taxa deve ser maior que zero."),
  feeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  campaignName: z.string().max(160).optional().nullable(),
  notes: z.string().max(400).optional().nullable(),
});

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const fees = await listCustomFees();
  return NextResponse.json({ ok: true, fees });
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const raw = (await request.json()) as Record<string, unknown>;
    let numericVal: number;
    if (typeof raw.value === "number") {
      numericVal = raw.value;
    } else {
      numericVal = Number(String(raw.value ?? "").trim().replace(/\s/g, "").replace(",", "."));
    }

    let dateStr = typeof raw.feeDate === "string" ? raw.feeDate.trim().slice(0, 10) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const d = new Date();
      dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    const parsed = createFeeSchema.safeParse({
      dashboardId: raw.dashboardId === "tiktok" ? "tiktok" : "omegapay",
      name: String(raw.name ?? "").trim(),
      category: raw.category || "GATEWAY",
      feeType: raw.feeType === "PERCENTAGE" ? "PERCENTAGE" : "FIXED",
      value: numericVal,
      feeDate: dateStr,
      campaignName: typeof raw.campaignName === "string" && raw.campaignName.trim() ? raw.campaignName.trim() : null,
      notes: typeof raw.notes === "string" && raw.notes.trim() ? raw.notes.trim() : null,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados de taxa inválidos." },
        { status: 400 }
      );
    }

    const fee = await createCustomFee({
      dashboardId: parsed.data.dashboardId as DashboardOperationId,
      name: parsed.data.name,
      category: parsed.data.category as FeeCategory,
      feeType: parsed.data.feeType as FeeType,
      value: parsed.data.value,
      feeDate: parsed.data.feeDate,
      campaignName: parsed.data.campaignName ?? null,
      notes: parsed.data.notes ?? null,
    });

    return NextResponse.json({ ok: true, fee }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao salvar taxa." },
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
  await deleteCustomFee(id);
  return NextResponse.json({ ok: true });
}
