import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  deleteTikTokConnection,
  getTikTokConnectionWithToken,
  listTikTokConnections,
  updateTikTokConnectionStatus,
} from "@/lib/db";
import {
  DEFAULT_TIKTOK_CALLBACK_URL,
  fetchAuthorizedTikTokAdvertisers,
  fetchAuthorizedTikTokBusinessCenters,
  getTikTokOAuthConfig,
  TikTokApiError,
} from "@/lib/tiktok-client";
import { decryptSecret } from "@/lib/token-crypto";
import { safeLog } from "@/lib/sanitize";

/**
 * Lista todas as conexões OAuth do TikTok Business pertencentes ao usuário autenticado.
 * Retorna APENAS metadados seguros (status, BCs, contas autorizadas) — NUNCA access_token ou secrets.
 */
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const cfg = getTikTokOAuthConfig();
  const connections = await listTikTokConnections(user.id);

  return NextResponse.json({
    ok: true,
    configured: cfg.isConfigured,
    callbackUrl: cfg.redirectUri || DEFAULT_TIKTOK_CALLBACK_URL,
    connections,
  });
}

/**
 * Revalida o token e atualiza a lista SOMENTE-LEITURA de Business Centers e Contas de Anúncios autorizadas.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      connectionId?: string;
    };
    const connectionId = String(body.connectionId || "").trim();
    if (!connectionId) {
      return NextResponse.json(
        { error: "Informe o ID da conexão TikTok." },
        { status: 400 }
      );
    }

    const conn = await getTikTokConnectionWithToken(connectionId, user.id);
    if (!conn) {
      return NextResponse.json(
        { error: "Conexão TikTok não encontrada ou sem permissão." },
        { status: 404 }
      );
    }

    let accessToken: string;
    try {
      accessToken = decryptSecret(conn.accessTokenEnc);
    } catch {
      await updateTikTokConnectionStatus(conn.id, user.id, {
        status: "REVOKED",
        lastError:
          "Não foi possível descriptografar o token armazenado. Reconecte sua conta TikTok Business.",
      });
      return NextResponse.json(
        {
          ok: false,
          error:
            "Token armazenado inválido. Clique em Conectar TikTok Business para autorizar novamente.",
        },
        { status: 401 }
      );
    }

    const [advertisers, bcResult] = await Promise.all([
      fetchAuthorizedTikTokAdvertisers(accessToken),
      fetchAuthorizedTikTokBusinessCenters(accessToken),
    ]);

    const now = new Date().toISOString();
    await updateTikTokConnectionStatus(conn.id, user.id, {
      status: "ACTIVE",
      lastError: bcResult.permissionWarning || null,
      lastSyncAt: now,
      advertisers,
      businessCenters: bcResult.businessCenters,
    });

    const updatedList = await listTikTokConnections(user.id);
    const updated = updatedList.find((c) => c.id === conn.id) || null;

    return NextResponse.json({
      ok: true,
      connection: updated,
    });
  } catch (err) {
    if (err instanceof TikTokApiError) {
      const body = (await request
        .clone()
        .json()
        .catch(() => ({}))) as { connectionId?: string };
      if (body.connectionId) {
        const nextStatus =
          err.category === "INVALID_TOKEN" ? "REVOKED" : "ERROR";
        await updateTikTokConnectionStatus(body.connectionId, user.id, {
          status: nextStatus,
          lastError: err.message,
        });
      }
      safeLog("warn", "Falha ao atualizar contas autorizadas do TikTok.", {
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
        error: "Erro inesperado ao atualizar contas autorizadas do TikTok.",
      },
      { status: 500 }
    );
  }
}

/**
 * Desconecta/remove uma conexão TikTok Business pertencente ao usuário autenticado.
 */
export async function DELETE(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json(
      { error: "ID da conexão obrigatório." },
      { status: 400 }
    );
  }

  const deleted = await deleteTikTokConnection(id, user.id);
  if (!deleted) {
    return NextResponse.json(
      { error: "Conexão TikTok não encontrada ou sem permissão." },
      { status: 404 }
    );
  }

  safeLog("info", "Conexão TikTok Business removida pelo usuário.", {
    connectionId: id,
  });

  return NextResponse.json({ ok: true });
}
