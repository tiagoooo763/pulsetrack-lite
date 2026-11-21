import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { upsertTikTokConnection } from "@/lib/db";
import {
  exchangeTikTokAuthCode,
  fetchAuthorizedTikTokAdvertisers,
  fetchAuthorizedTikTokBusinessCenters,
  TikTokApiError,
} from "@/lib/tiktok-client";
import {
  encryptSecret,
  TIKTOK_OAUTH_NONCE_COOKIE,
  verifyTikTokOAuthState,
} from "@/lib/token-crypto";
import { safeLog } from "@/lib/sanitize";

function redirectWithClearedNonce(targetUrl: URL): NextResponse {
  const response = NextResponse.redirect(targetUrl);
  response.cookies.set(TIKTOK_OAUTH_NONCE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/integrations/tiktok",
    maxAge: 0,
  });
  return response;
}

/**
 * Callback OAuth oficial da TikTok Marketing API:
 * https://www.usedashfy.com.br/api/integrations/tiktok/callback
 *
 * - Valida sessão autenticada + parâmetro `state` + cookie HttpOnly de nonce (anti-CSRF).
 * - Recebe `auth_code` (ou `code`) e troca pelo `access_token` no servidor.
 * - Consulta apenas Business Centers e Contas de Anúncios autorizadas (somente-leitura).
 * - Armazena o `access_token` criptografado (AES-256-GCM) no Supabase associado ao `user.id`.
 * - Nunca expõe `auth_code`, `access_token` ou `app_secret` em URLs, logs ou frontend.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const user = await getAuthenticatedUser();

  if (!user) {
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set(
      "auth_error",
      "Sua sessão expirou durante a autorização do TikTok. Entre novamente na Dashfy e repita a conexão."
    );
    return redirectWithClearedNonce(loginUrl);
  }

  const providerError =
    url.searchParams.get("error_description") ||
    url.searchParams.get("error_msg") ||
    url.searchParams.get("error");

  if (providerError) {
    safeLog("warn", "Autorização TikTok cancelada ou recusada pelo usuário.", {
      providerError,
    });
    const dashUrl = new URL("/dashboard", url.origin);
    dashUrl.searchParams.set(
      "tiktok_error",
      "A autorização no TikTok Business foi cancelada ou recusada. Nenhuma conta foi conectada."
    );
    return redirectWithClearedNonce(dashUrl);
  }

  const stateParam = url.searchParams.get("state");
  const cookieNonce = request.cookies.get(TIKTOK_OAUTH_NONCE_COOKIE)?.value;
  const stateCheck = verifyTikTokOAuthState({
    state: stateParam,
    expectedUserId: user.id,
    cookieNonce,
  });

  if (!stateCheck.valid) {
    safeLog("warn", "Callback OAuth TikTok bloqueado por validação de state.", {
      reason: stateCheck.reason,
    });
    const dashUrl = new URL("/dashboard", url.origin);
    dashUrl.searchParams.set("tiktok_error", stateCheck.reason);
    return redirectWithClearedNonce(dashUrl);
  }

  const dashboardId = stateCheck.dashboardId;
  const authCode =
    url.searchParams.get("auth_code")?.trim() ||
    url.searchParams.get("code")?.trim() ||
    "";

  if (!authCode) {
    const dashUrl = new URL("/dashboard", url.origin);
    dashUrl.searchParams.set("tiktok_dashboard", dashboardId);
    dashUrl.searchParams.set(
      "tiktok_error",
      "O TikTok não retornou o código de autorização (auth_code). Tente conectar novamente."
    );
    return redirectWithClearedNonce(dashUrl);
  }

  try {
    // 1. Troca auth_code por access_token no servidor
    const tokenResult = await exchangeTikTokAuthCode(authCode);

    // 2. Consulta SOMENTE contas de anúncios e Business Centers autorizados
    const [advertisersList, bcResult] = await Promise.all([
      fetchAuthorizedTikTokAdvertisers(tokenResult.accessToken).catch((err) => {
        if (err instanceof TikTokApiError && err.category === "INVALID_TOKEN") {
          throw err;
        }
        safeLog("warn", "Fallback para advertiser_ids retornados no token.", {
          reason: err instanceof Error ? err.message : "unknown",
        });
        return [];
      }),
      fetchAuthorizedTikTokBusinessCenters(tokenResult.accessToken),
    ]);

    const mergedAdvertisers =
      advertisersList.length > 0
        ? advertisersList
        : tokenResult.advertiserIds.map((advId) => ({
            advertiserId: advId,
            advertiserName: `Conta TikTok Ads (${advId})`,
          }));

    if (
      mergedAdvertisers.length === 0 &&
      bcResult.businessCenters.length === 0
    ) {
      const dashUrl = new URL("/dashboard", url.origin);
      dashUrl.searchParams.set("tiktok_dashboard", dashboardId);
      dashUrl.searchParams.set(
        "tiktok_error",
        "A autorização foi concluída, mas nenhuma conta de anúncios ou Business Center autorizado foi encontrado nesta conta TikTok."
      );
      return redirectWithClearedNonce(dashUrl);
    }

    // 3. Criptografa access_token (AES-256-GCM) e persiste vinculado ao user.id
    const accessTokenEnc = encryptSecret(tokenResult.accessToken);
    const saved = await upsertTikTokConnection({
      userId: user.id,
      dashboardId,
      label: stateCheck.label,
      accessTokenEnc,
      scope: tokenResult.scope,
      advertisers: mergedAdvertisers,
      businessCenters: bcResult.businessCenters,
      status: "ACTIVE",
      lastError: bcResult.permissionWarning || null,
      lastSyncAt: new Date().toISOString(),
    });

    safeLog("info", "Conexão OAuth TikTok Business salva com segurança.", {
      connectionId: saved.id,
      advertisersCount: saved.advertisers.length,
      businessCentersCount: saved.businessCenters.length,
    });

    const dashUrl = new URL("/dashboard", url.origin);
    dashUrl.searchParams.set("tiktok_connected", "1");
    dashUrl.searchParams.set("tiktok_dashboard", dashboardId);
    dashUrl.searchParams.set(
      "tiktok_accounts",
      String(saved.advertisers.length)
    );
    return redirectWithClearedNonce(dashUrl);
  } catch (err) {
    const friendlyMessage =
      err instanceof TikTokApiError
        ? err.message
        : "Não foi possível concluir a troca de credenciais com o TikTok Business. Tente novamente.";

    safeLog("error", "Erro no callback OAuth TikTok Business.", {
      category: err instanceof TikTokApiError ? err.category : "UNKNOWN",
      code: err instanceof TikTokApiError ? err.code : -1,
    });

    const dashUrl = new URL("/dashboard", url.origin);
    dashUrl.searchParams.set("tiktok_dashboard", dashboardId);
    dashUrl.searchParams.set("tiktok_error", friendlyMessage);
    return redirectWithClearedNonce(dashUrl);
  }
}
