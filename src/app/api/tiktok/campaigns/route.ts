import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  createTikTokCampaign,
  deleteTikTokCampaign,
  listTikTokCampaigns,
  updateTikTokCampaignStatus,
} from "@/lib/db";

const singleCampaignSchema = z.object({
  dashboardId: z.string().min(1).max(60).optional().default("tiktok"),
  adAccount: z.string().max(120).optional().default("Conta Principal TikTok"),
  campaignName: z.string().min(1, "Informe o nome da campanha.").max(160),
  adgroupName: z.string().max(160).optional().default("Conjunto Padrão"),
  adName: z.string().max(160).optional().default("Anúncio 01"),
  productName: z.string().max(160).optional().default("Produto Principal"),
  utmSource: z.string().max(80).optional().default("tiktok"),
  utmMedium: z.string().max(80).optional().default("cpc"),
  utmCampaign: z.string().max(160).optional().default(""),
  utmContent: z.string().max(160).optional().default(""),
  statDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)."),
  spend: z.number().min(0),
  impressions: z.number().min(0).default(0),
  clicks: z.number().min(0).default(0),
  conversions: z.number().min(0).default(0),
  attributedRevenue: z.number().min(0).default(0),
  status: z.enum(["ACTIVE", "PAUSED"]).optional().default("ACTIVE"),
});

function parseNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "0")
    .trim()
    .replace(/R\$/gi, "")
    .replace(/\s/g, "");
  const normalized =
    s.includes(",") && s.includes(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const campaigns = await listTikTokCampaigns(user.id);
  return NextResponse.json({ ok: true, campaigns });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const raw = (await request.json()) as Record<string, unknown>;
    const rawRows = Array.isArray(raw.rows) ? raw.rows : [raw];

    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: "Nenhum registro informado para importação." },
        { status: 400 }
      );
    }

    if (rawRows.length > 500) {
      return NextResponse.json(
        { error: "Limite máximo de 500 linhas por importação CSV." },
        { status: 400 }
      );
    }

    const created = [];
    for (const item of rawRows) {
      const obj = (item || {}) as Record<string, unknown>;
      let statDate = String(obj.statDate || "").trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(statDate)) {
        statDate = getTodayDate();
      }

      const parsed = singleCampaignSchema.safeParse({
        dashboardId: String(obj.dashboardId || raw.dashboardId || "tiktok").trim(),
        adAccount: String(obj.adAccount || "Conta Principal TikTok").trim(),
        campaignName: String(obj.campaignName || "").trim(),
        adgroupName: String(obj.adgroupName || "Conjunto Padrão").trim(),
        adName: String(obj.adName || "Anúncio 01").trim(),
        productName: String(obj.productName || "Produto Principal").trim(),
        utmSource: String(obj.utmSource || "tiktok").trim(),
        utmMedium: String(obj.utmMedium || "cpc").trim(),
        utmCampaign: String(obj.utmCampaign || obj.campaignName || "").trim(),
        utmContent: String(obj.utmContent || obj.adName || "").trim(),
        statDate,
        spend: parseNum(obj.spend),
        impressions: Math.max(0, Math.round(parseNum(obj.impressions))),
        clicks: Math.max(0, Math.round(parseNum(obj.clicks))),
        conversions: Math.max(0, Math.round(parseNum(obj.conversions))),
        attributedRevenue: parseNum(obj.attributedRevenue),
        status:
          String(obj.status || "ACTIVE").toUpperCase() === "PAUSED"
            ? "PAUSED"
            : "ACTIVE",
      });

      if (!parsed.success) {
        if (rawRows.length === 1) {
          return NextResponse.json(
            {
              error:
                parsed.error.issues[0]?.message || "Dados de campanha inválidos.",
            },
            { status: 400 }
          );
        }
        continue;
      }

      const record = await createTikTokCampaign({
        ...parsed.data,
        userId: user.id,
      });
      created.push(record);
    }

    return NextResponse.json(
      { ok: true, importedCount: created.length, campaigns: created },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao salvar campanhas do TikTok.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { id?: string; status?: string };
    if (!body.id) {
      return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    }
    const status = body.status === "PAUSED" ? "PAUSED" : "ACTIVE";
    const updated = await updateTikTokCampaignStatus(body.id, status, user.id);
    if (!updated) {
      return NextResponse.json(
        { error: "Campanha não encontrada ou sem permissão." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Erro ao atualizar status da campanha." },
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
    return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
  }
  const deleted = await deleteTikTokCampaign(id, user.id);
  if (!deleted) {
    return NextResponse.json(
      { error: "Campanha não encontrada ou sem permissão." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
