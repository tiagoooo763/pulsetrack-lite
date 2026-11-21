import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { claimLegacyDataForOwner, ensureUserProfile } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getSafeNextPath(rawNext: string | null): string {
  if (!rawNext) return "/";
  const trimmed = rawNext.trim();
  // Impede open redirect: aceita apenas caminhos relativos internos começando com '/'
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/";
  }
  return trimmed;
}

const VALID_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "recovery",
  "invite",
  "magiclink",
  "email_change",
  "email",
]);

/**
 * Callback do Supabase Auth (PKCE `code` e `token_hash` + `type`) para:
 * - Confirmação de e-mail após cadastro (/cadastro)
 * - Recuperação de senha (/recuperar-senha -> /redefinir-senha)
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const otpType = url.searchParams.get("type");
  const nextPath = getSafeNextPath(url.searchParams.get("next"));
  const errorDesc = url.searchParams.get("error_description");

  if (errorDesc) {
    const failUrl = new URL("/", url.origin);
    failUrl.searchParams.set("auth_error", errorDesc);
    return NextResponse.redirect(failUrl);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const failUrl = new URL("/", url.origin);
    failUrl.searchParams.set(
      "auth_error",
      "Autenticação Supabase não configurada neste servidor."
    );
    return NextResponse.redirect(failUrl);
  }

  let verifiedUser: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  } | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user) {
      verifiedUser = data.user;
    }
  } else if (
    tokenHash &&
    otpType &&
    VALID_OTP_TYPES.has(otpType as EmailOtpType)
  ) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as EmailOtpType,
    });
    if (!error && data?.user) {
      verifiedUser = data.user;
    }
  }

  if (verifiedUser) {
    const email = (verifiedUser.email || "").trim().toLowerCase();
    const meta = (verifiedUser.user_metadata || {}) as Record<string, unknown>;
    const displayName =
      (typeof meta.display_name === "string" && meta.display_name) ||
      (typeof meta.full_name === "string" && meta.full_name) ||
      email.split("@")[0];
    const companyName =
      typeof meta.company_name === "string"
        ? meta.company_name
        : "Dashfy Workspace";

    await ensureUserProfile({
      id: verifiedUser.id,
      email,
      displayName,
      companyName,
    });
    await claimLegacyDataForOwner(verifiedUser.id, email);

    const targetUrl = new URL(nextPath, url.origin);
    if (nextPath === "/" && otpType !== "recovery") {
      targetUrl.searchParams.set("confirmed", "1");
    }
    return NextResponse.redirect(targetUrl);
  }

  const fallback = new URL("/", url.origin);
  fallback.searchParams.set(
    "auth_error",
    "Link de autenticação inválido ou expirado. Tente novamente."
  );
  return NextResponse.redirect(fallback);
}
