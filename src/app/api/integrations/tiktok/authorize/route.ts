import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  buildTikTokAuthorizeUrl,
  getTikTokOAuthConfig,
} from "@/lib/tiktok-client";
import {
  createTikTokOAuthState,
  TIKTOK_OAUTH_NONCE_COOKIE,
} from "@/lib/token-crypto";
import { safeLog } from "@/lib/sanitize";

/**
 * Inicia o fluxo oficial OAuth 2.0 com a TikTok Marketing API.
 * - Exige usuário autenticado na Dashfy.
 * - Gera `state` assinado com HMAC + `nonce` em cookie HttpOnly (anti-CSRF).
 * - Redireciona para https://business-api.tiktok.com/portal/auth
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const user = await getAuthenticatedUser();

  if (!user) {
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set(
      "auth_error",
      "Faça login na Dashfy antes de conectar sua conta TikTok Business."
    );
    return NextResponse.redirect(loginUrl);
  }

  const dashboardId =
    url.searchParams.get("dashboardId")?.trim().slice(0, 60) || "tiktok";
  const label = url.searchParams.get("label")?.trim().slice(0, 80) || undefined;

  const cfg = getTikTokOAuthConfig();
  if (!cfg.isConfigured) {
    const dashUrl = new URL("/dashboard", url.origin);
    dashUrl.searchParams.set("tiktok_dashboard", dashboardId);
    dashUrl.searchParams.set(
      "tiktok_error",
      "Configure TIKTOK_APP_ID e TIKTOK_APP_SECRET nas variáveis de ambiente do servidor (Vercel) para ativar o botão Conectar TikTok Business."
    );
    return NextResponse.redirect(dashUrl);
  }

  try {
    const { state, nonce } = createTikTokOAuthState({
      userId: user.id,
      dashboardId,
      label,
    });

    const authorizeUrl = buildTikTokAuthorizeUrl({
      state,
      redirectUri: cfg.redirectUri,
    });

    safeLog("info", "Fluxo OAuth TikTok Business iniciado para usuário autenticado.", {
      dashboardId,
    });

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(TIKTOK_OAUTH_NONCE_COOKIE, nonce, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/integrations/tiktok",
      maxAge: 600, // 10 minutos
    });
    return response;
  } catch (err) {
    safeLog("error", "Falha ao iniciar fluxo OAuth TikTok Business.", {
      reason: err instanceof Error ? err.message : "unknown",
    });
    const dashUrl = new URL("/dashboard", url.origin);
    dashUrl.searchParams.set("tiktok_dashboard", dashboardId);
    dashUrl.searchParams.set(
      "tiktok_error",
      "Não foi possível iniciar a autorização com o TikTok Business. Tente novamente."
    );
    return NextResponse.redirect(dashUrl);
  }
}
