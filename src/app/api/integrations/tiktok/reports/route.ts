import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  createTikTokCampaign,
  getTikTokConnectionWithToken,
  listTikTokCampaigns,
  listTransactions,
  updateTikTokConnectionStatus,
} from "@/lib/db";
import {
  fetchTikTokReadOnlyReport,
  TikTokApiError,
} from "@/lib/tiktok-client";
import { decryptSecret } from "@/lib/token-crypto";
import { safeLog } from "@/lib/sanitize";

const reportRequestSchema = z.object({
  connectionId: z.string().min(1, "Selecione uma conexão TikTok."),
  advertiserId: z.string().min(1, "Selecione uma conta de anúncios autorizada."),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida (YYYY-MM-DD)."),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida (YYYY-MM-DD)."),
  dataLevel: z
    .enum(["AUCTION_CAMPAIGN", "AUCTION_ADGROUP", "AUCTION_AD"])
    .optional()
    .default("AUCTION_CAMPAIGN"),
  syncToDashboard: z.boolean().optional().default(false),
  dashboardId: z.string().min(1).max(60).optional().default("tiktok"),
});

/**
 * Consulta SOMENTE-LEITURA de gastos e relatórios da TikTok Marketing API
 * para uma conta de anúncios autorizada pertencente ao usuário autenticado.
 * - NÃO modifica campanhas, conjuntos ou anúncios no TikTok.
 * - NÃO altera dados financeiros existentes na Dashfy.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const raw = (await request.json()) as Record<string, unknown>;
    const parsed = reportRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error:
            parsed.error.issues[0]?.message ||
            "Parâmetros de consulta inválidos.",
        },
        { status: 400 }
      );
    }

    const {
      connectionId,
      advertiserId,
      startDate,
      endDate,
      dataLevel,
      syncToDashboard,
      dashboardId,
    } = parsed.data;
    if (startDate > endDate) {
      return NextResponse.json(
        { ok: false, error: "A data inicial não pode ser maior que a data final." },
        { status: 400 }
      );
    }

    const diffDays =
      (new Date(endDate).getTime() - new Date(startDate).getTime()) /
      (1000 * 60 * 60 * 24);
    if (diffDays > 90) {
      return NextResponse.json(
        {
          ok: false,
          error: "Selecione um período de no máximo 90 dias por consulta.",
        },
        { status: 400 }
      );
    }

    // 1. Garante que a conexão pertence ao usuário autenticado
    const conn = await getTikTokConnectionWithToken(connectionId, user.id);
    if (!conn) {
      return NextResponse.json(
        { ok: false, error: "Conexão TikTok não encontrada ou sem permissão." },
        { status: 404 }
      );
    }

    // 2. Garante que o advertiserId realmente está entre as contas autorizadas nesta conexão
    const isAuthorizedAccount = conn.advertisers.some(
      (a) => a.advertiserId === advertiserId
    );
    if (!isAuthorizedAccount) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A conta de anúncios selecionada não faz parte das contas autorizadas nesta conexão.",
        },
        { status: 403 }
      );
    }

    let accessToken: string;
    try {
      accessToken = decryptSecret(conn.accessTokenEnc);
    } catch {
      await updateTikTokConnectionStatus(conn.id, user.id, {
        status: "REVOKED",
        lastError: "Token armazenado inválido. Reconecte sua conta TikTok Business.",
      });
      return NextResponse.json(
        {
          ok: false,
          error: "Token inválido ou expirado. Reconecte sua conta TikTok Business.",
        },
        { status: 401 }
      );
    }

    const report = await fetchTikTokReadOnlyReport({
      accessToken,
      advertiserId,
      startDate,
      endDate,
      dataLevel,
    });

    await updateTikTokConnectionStatus(conn.id, user.id, {
      status: "ACTIVE",
      lastError: null,
      lastSyncAt: new Date().toISOString(),
    });

    // Cruzamento real: quanto caiu líquido no Gateway do usuário vs quanto gastou no TikTok Ads no mesmo período
    const allTx = await listTransactions(user.id, 1000);
    const periodApprovedTx = allTx.filter((tx) => {
      if (tx.status !== "COMPLETED") return false;
      const day = (tx.paidAt || tx.createdAt || "").slice(0, 10);
      return day >= startDate && day <= endDate;
    });
    const gatewayGrossRevenue = Number(
      periodApprovedTx.reduce((acc, tx) => acc + tx.grossAmount, 0).toFixed(2)
    );
    const gatewayFees = Number(
      periodApprovedTx.reduce((acc, tx) => acc + tx.feeAmount, 0).toFixed(2)
    );
    const gatewayNetRevenue = Number(
      periodApprovedTx.reduce((acc, tx) => acc + tx.netAmount, 0).toFixed(2)
    );
    const gatewayApprovedSales = periodApprovedTx.length;
    const tiktokSpend = report.totals.spend;
    const realProfit = Number((gatewayNetRevenue - tiktokSpend).toFixed(2));
    const realRoas =
      tiktokSpend > 0
        ? Number((gatewayGrossRevenue / tiktokSpend).toFixed(2))
        : 0;
    const realCpa =
      gatewayApprovedSales > 0
        ? Number((tiktokSpend / gatewayApprovedSales).toFixed(2))
        : 0;

    // Opcional: sincroniza as linhas da API para a operação Dashfy (evitando duplicatas por dia/campanha/anúncio)
    let syncedCount = 0;
    if (syncToDashboard && report.rows.length > 0) {
      const advObj = conn.advertisers.find((a) => a.advertiserId === advertiserId);
      const adAccountLabel = advObj?.advertiserName || `TikTok ${advertiserId}`;
      const existingRows = await listTikTokCampaigns(user.id);
      const existingSig = new Set(
        existingRows
          .filter((r) => (r.dashboardId || "tiktok") === dashboardId)
          .map(
            (r) =>
              `${r.adAccount}::${r.campaignName}::${r.adgroupName}::${r.adName}::${r.statDate}`
          )
      );

      for (const row of report.rows.slice(0, 200)) {
        const adgroupName = row.adgroupName || "Conjunto API TikTok";
        const adName = row.adName || "Relatório API TikTok";
        const sig = `${adAccountLabel}::${row.campaignName}::${adgroupName}::${adName}::${row.statDate}`;
        if (existingSig.has(sig)) continue;
        await createTikTokCampaign({
          userId: user.id,
          dashboardId,
          adAccount: adAccountLabel,
          campaignName: row.campaignName,
          adgroupName,
          adName,
          productName: row.campaignName,
          utmSource: "tiktok",
          utmMedium: "paid",
          utmCampaign: row.campaignName,
          utmContent: adName,
          statDate: row.statDate,
          spend: row.spend,
          impressions: row.impressions,
          clicks: row.clicks,
          conversions: row.purchases,
          attributedRevenue: row.attributedRevenue,
          status: "ACTIVE",
        });
        existingSig.add(sig);
        syncedCount += 1;
      }
    }

    safeLog("info", "Relatório somente-leitura TikTok consultado com sucesso.", {
      advertiserId,
      dataLevel,
      rowsCount: report.rows.length,
      syncedCount,
    });

    return NextResponse.json({
      ok: true,
      report,
      syncedCount,
      financialCrossCheck: {
        gatewayGrossRevenue,
        gatewayNetRevenue,
        gatewayFees,
        gatewayApprovedSales,
        tiktokSpend,
        realProfit,
        realRoas,
        realCpa,
      },
    });
  } catch (err) {
    if (err instanceof TikTokApiError) {
      safeLog("warn", "Falha na consulta de relatório somente-leitura TikTok.", {
        category: err.category,
        code: err.code,
      });
      return NextResponse.json(
        { ok: false, error: err.message, category: err.category },
        { status: err.httpStatus }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Erro inesperado ao consultar relatório na TikTok Marketing API.",
      },
      { status: 500 }
    );
  }
}
