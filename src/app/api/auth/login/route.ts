import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  getExpectedDashboardCredentials,
  SESSION_COOKIE_NAME,
  timingSafeStringCompare,
} from "@/lib/auth";
import { claimLegacyDataForOwner, ensureUserProfile } from "@/lib/db";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeLog } from "@/lib/sanitize";

export async function POST(request: NextRequest) {
  try {
    const ip = extractClientIp(request.headers);
    const body = (await request.json()) as {
      email?: string;
      username?: string;
      password?: string;
    };

    const identifier = (body.email || body.username || "").trim().toLowerCase();
    const password = body.password || "";

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Informe seu e-mail e senha para entrar." },
        { status: 400 }
      );
    }

    // Proteção contra força bruta (por IP e por e-mail)
    const ipLimit = checkRateLimit({
      key: `login:ip:${ip}`,
      limit: 12,
      windowMs: 15 * 60 * 1000,
    });
    const userLimit = checkRateLimit({
      key: `login:user:${identifier}`,
      limit: 8,
      windowMs: 15 * 60 * 1000,
    });

    if (!ipLimit.allowed || !userLimit.allowed) {
      const retry = Math.max(ipLimit.retryAfterSeconds, userLimit.retryAfterSeconds);
      safeLog("warn", "Tentativas abusivas de login bloqueadas por rate limit.");
      return NextResponse.json(
        {
          error: `Muitas tentativas de login. Aguarde ${Math.ceil(retry / 60)} minuto(s) e tente novamente.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retry) },
        }
      );
    }

    // 1. Autenticação oficial via Supabase Auth (múltiplos usuários)
    if (isSupabaseAuthConfigured() && identifier.includes("@")) {
      const supabase = await createSupabaseServerClient();
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: identifier,
          password,
        });

        if (!error && data.user) {
          const email = (data.user.email || identifier).toLowerCase();
          const meta = (data.user.user_metadata || {}) as Record<string, unknown>;
          const displayName =
            (typeof meta.display_name === "string" && meta.display_name) ||
            (typeof meta.full_name === "string" && meta.full_name) ||
            email.split("@")[0];
          const companyName =
            typeof meta.company_name === "string"
              ? meta.company_name
              : "Dashfy Workspace";

          await ensureUserProfile({
            id: data.user.id,
            email,
            displayName,
            companyName,
          });
          await claimLegacyDataForOwner(data.user.id, email);

          safeLog("info", "Login realizado com sucesso via Supabase Auth.");
          return NextResponse.json({
            ok: true,
            username: email,
            userId: data.user.id,
            provider: "supabase",
          });
        }

        if (error) {
          const msg = (error.message || "").toLowerCase();
          if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
            return NextResponse.json(
              {
                error:
                  "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada (ou spam) e clique no link de confirmação.",
                code: "EMAIL_NOT_CONFIRMED",
              },
              { status: 403 }
            );
          }
          if (msg.includes("rate limit") || error.status === 429) {
            return NextResponse.json(
              {
                error:
                  "Limite de tentativas excedido no servidor de autenticação. Aguarde alguns instantes.",
              },
              { status: 429 }
            );
          }
        }
      }
    }

    // 2. Fallback seguro para a conta proprietária legada (preserva acesso ininterrupto)
    const expected = await getExpectedDashboardCredentials();
    const expectedUser = expected.username.toLowerCase();

    const userMatch =
      timingSafeStringCompare(identifier, expectedUser) ||
      (expectedUser === "mendoncat831@gmail.com" &&
        timingSafeStringCompare(identifier, "admin")) ||
      (expectedUser === "admin" &&
        timingSafeStringCompare(identifier, "mendoncat831@gmail.com"));

    const passMatch = timingSafeStringCompare(password, expected.password);

    if (!userMatch || !passMatch) {
      safeLog("warn", "Tentativa de login inválida no Dashfy.");
      return NextResponse.json(
        { error: "E-mail ou senha inválidos." },
        { status: 401 }
      );
    }

    const token = createSessionToken(expected.username);
    const response = NextResponse.json({
      ok: true,
      username: expected.username,
      provider: "legacy",
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    safeLog("info", "Sessão iniciada com sucesso (conta proprietária).");
    return response;
  } catch {
    return NextResponse.json(
      { error: "Não foi possível processar o login." },
      { status: 400 }
    );
  }
}
