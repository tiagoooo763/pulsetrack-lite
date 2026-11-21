import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureUserProfile } from "@/lib/db";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import {
  getPublicAppUrl,
  isSupabaseAuthConfigured,
} from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeLog } from "@/lib/sanitize";

const signupSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Informe seu nome completo (mínimo 2 caracteres).")
    .max(80, "Nome muito longo."),
  companyName: z.string().trim().max(80).optional(),
  email: z.string().trim().email("Informe um endereço de e-mail válido.").max(140),
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres.")
    .max(128, "Senha muito longa.")
    .refine(
      (val) => /[a-zA-Z]/.test(val) && /\d/.test(val),
      "A senha deve conter pelo menos uma letra e um número."
    ),
});

export async function POST(request: NextRequest) {
  try {
    const ip = extractClientIp(request.headers);
    const limit = checkRateLimit({
      key: `signup:ip:${ip}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });

    if (!limit.allowed) {
      safeLog("warn", "Tentativas abusivas de cadastro bloqueadas por rate limit.");
      return NextResponse.json(
        {
          error: `Muitas tentativas de cadastro. Aguarde ${Math.ceil(limit.retryAfterSeconds / 60)} minuto(s) e tente novamente.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        }
      );
    }

    if (!isSupabaseAuthConfigured()) {
      return NextResponse.json(
        {
          error:
            "Cadastro temporariamente indisponível: configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY nas variáveis de ambiente.",
        },
        { status: 503 }
      );
    }

    const raw = (await request.json()) as Record<string, unknown>;
    const parsed = signupSchema.safeParse({
      displayName: raw.displayName,
      companyName: raw.companyName || undefined,
      email: typeof raw.email === "string" ? raw.email.toLowerCase() : "",
      password: raw.password,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados de cadastro inválidos." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Serviço de autenticação Supabase indisponível." },
        { status: 503 }
      );
    }

    const origin = request.headers.get("origin") || new URL(request.url).origin;
    const appUrl = getPublicAppUrl(origin);
    const emailRedirectTo = `${appUrl}/auth/callback?next=/`;

    const companyName = parsed.data.companyName || "Dashfy Workspace";

    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo,
        data: {
          display_name: parsed.data.displayName,
          company_name: companyName,
        },
      },
    });

    if (error) {
      const lower = (error.message || "").toLowerCase();
      if (lower.includes("already registered") || lower.includes("already exists")) {
        return NextResponse.json(
          { error: "Este e-mail já está cadastrado. Faça login ou recupere sua senha." },
          { status: 409 }
        );
      }
      if (lower.includes("rate limit") || error.status === 429) {
        return NextResponse.json(
          { error: "Muitas solicitações de cadastro. Aguarde alguns minutos." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: error.message || "Não foi possível concluir o cadastro." },
        { status: 400 }
      );
    }

    // Supabase retorna identities vazio quando o e-mail já existe (proteção contra enumeração)
    if (
      data.user &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0
    ) {
      return NextResponse.json(
        { error: "Este e-mail já está cadastrado. Faça login ou recupere sua senha." },
        { status: 409 }
      );
    }

    if (data.user) {
      await ensureUserProfile({
        id: data.user.id,
        email: parsed.data.email,
        displayName: parsed.data.displayName,
        companyName,
      });
    }

    const requiresEmailConfirmation = !data.session;

    safeLog("info", "Novo usuário cadastrado com sucesso na Dashfy.");
    return NextResponse.json(
      {
        ok: true,
        requiresEmailConfirmation,
        message: requiresEmailConfirmation
          ? "Conta criada! Enviamos um link de confirmação para o seu e-mail. Confirme para acessar seu painel."
          : "Conta criada com sucesso! Redirecionando para o seu painel...",
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Erro inesperado ao processar o cadastro." },
      { status: 500 }
    );
  }
}
