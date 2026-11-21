import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { claimLegacyDataForOwner, ensureUserProfile } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getSafeNextPath(
  rawNext: string | null,
  otpType: string | null
): string {
  if (rawNext) {
    const trimmed = rawNext.trim();
    // Impede open redirect: aceita apenas caminhos relativos internos começando com '/'
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
      return trimmed === "/" ? "/dashboard" : trimmed;
    }
  }

  // Fallback inteligente caso o template de e-mail não inclua ?next=...
  if (otpType === "recovery" || otpType === "invite") {
    return "/redefinir-senha";
  }
  return "/dashboard";
}

function translateAuthCallbackError(
  errorCode: string | null,
  errorDesc: string | null
): string {
  const combined = `${errorCode || ""} ${errorDesc || ""}`.toLowerCase();
  if (combined.includes("otp_expired") || combined.includes("expired")) {
    return "Este link de verificação expirou ou já foi utilizado. Solicite um novo link.";
  }
  if (combined.includes("access_denied")) {
    return "Link de autenticação inválido, cancelado ou expirado. Tente novamente.";
  }
  if (combined.includes("rate_limit") || combined.includes("too many")) {
    return "Muitas tentativas em sequência. Aguarde alguns minutos e tente novamente.";
  }
  if (combined.includes("invalid")) {
    return "Link de autenticação inválido. Solicite um novo e-mail.";
  }
  return "Não foi possível validar o link de autenticação. Solicite um novo envio.";
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
 * Callback oficial do Supabase Auth (PKCE `code` e `token_hash` + `type`) para:
 * - Confirmação de e-mail após cadastro (/cadastro -> /dashboard)
 * - Recuperação de senha (/recuperar-senha -> /redefinir-senha)
 * - Alteração segura de e-mail (Minha Conta -> /dashboard)
 * - Convites administrativos (se enviados pelo painel Supabase -> /redefinir-senha)
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const otpType = url.searchParams.get("type");
  const nextPath = getSafeNextPath(url.searchParams.get("next"), otpType);
  const errorParam = url.searchParams.get("error");
  const errorCode = url.searchParams.get("error_code");
  const errorDesc = url.searchParams.get("error_description");

  if (errorParam || errorCode || errorDesc) {
    const failUrl = new URL("/login", url.origin);
    failUrl.searchParams.set(
      "auth_error",
      translateAuthCallbackError(errorCode || errorParam, errorDesc)
    );
    return NextResponse.redirect(failUrl);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const failUrl = new URL("/login", url.origin);
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
  let verifyErrorMessage: string | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user) {
      verifiedUser = data.user;
    } else if (error) {
      verifyErrorMessage = error.message;
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
    } else if (error) {
      verifyErrorMessage = error.message;
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
    if (nextPath === "/dashboard") {
      if (otpType === "email_change") {
        targetUrl.searchParams.set("auth_notice", "email_changed");
      } else if (otpType === "signup" || otpType === "email" || code) {
        targetUrl.searchParams.set("auth_notice", "email_confirmed");
      }
    }
    return NextResponse.redirect(targetUrl);
  }

  const fallback = new URL("/login", url.origin);
  fallback.searchParams.set(
    "auth_error",
    translateAuthCallbackError(null, verifyErrorMessage)
  );
  return NextResponse.redirect(fallback);
}
