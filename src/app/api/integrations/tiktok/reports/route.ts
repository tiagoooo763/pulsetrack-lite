import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getTikTokConnectionWithToken,
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

    const { connectionId, advertiserId, startDate, endDate } = parsed.data;
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
    });

    await updateTikTokConnectionStatus(conn.id, user.id, {
      status: "ACTIVE",
      lastError: null,
      lastSyncAt: new Date().toISOString(),
    });

    safeLog("info", "Relatório somente-leitura TikTok consultado com sucesso.", {
      advertiserId,
      rowsCount: report.rows.length,
    });

    return NextResponse.json({
      ok: true,
      report,
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
