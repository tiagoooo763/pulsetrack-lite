import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import {
  getPublicAppUrl,
  isSupabaseAuthConfigured,
} from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeLog } from "@/lib/sanitize";

const changeEmailSchema = z.object({
  newEmail: z
    .string()
    .trim()
    .email("Informe um endereço de e-mail válido.")
    .max(140),
});

/**
 * Inicia o fluxo seguro de alteração de e-mail via Supabase Auth.
 * Envia e-mail de confirmação pelo remetente configurado (naoresponda@auth.usedashfy.com.br)
 * com redirecionamento para https://www.usedashfy.com.br/auth/callback.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (user.authProvider !== "supabase") {
    return NextResponse.json(
      {
        error:
          "A alteração de e-mail automática está disponível para contas autenticadas via Supabase Auth.",
      },
      { status: 400 }
    );
  }

  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json(
      { error: "Serviço de autenticação Supabase indisponível." },
      { status: 503 }
    );
  }

  try {
    const ip = extractClientIp(request.headers);
    const limit = checkRateLimit({
      key: `change-email:${user.id}:${ip}`,
      limit: 3,
      windowMs: 15 * 60 * 1000,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: `Muitas tentativas de alteração de e-mail. Aguarde ${Math.ceil(limit.retryAfterSeconds / 60)} minuto(s) e tente novamente.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        }
      );
    }

    const raw = (await request.json().catch(() => ({}))) as {
      newEmail?: string;
    };
    const parsed = changeEmailSchema.safeParse({
      newEmail: typeof raw.newEmail === "string" ? raw.newEmail.toLowerCase() : "",
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Novo e-mail inválido." },
        { status: 400 }
      );
    }

    const targetEmail = parsed.data.newEmail;
    if (targetEmail === user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Informe um e-mail diferente do seu e-mail atual." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Serviço de autenticação indisponível." },
        { status: 503 }
      );
    }

    const origin = request.headers.get("origin") || new URL(request.url).origin;
    const appUrl = getPublicAppUrl(origin);
    const emailRedirectTo = `${appUrl}/auth/callback?next=/dashboard&type=email_change`;

    const { error } = await supabase.auth.updateUser(
      { email: targetEmail },
      { emailRedirectTo }
    );

    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (
        msg.includes("already been registered") ||
        msg.includes("already registered") ||
        msg.includes("already exists") ||
        msg.includes("duplicate")
      ) {
        return NextResponse.json(
          { error: "Este novo e-mail já está em uso por outra conta." },
          { status: 409 }
        );
      }
      if (msg.includes("rate limit") || error.status === 429) {
        return NextResponse.json(
          {
            error:
              "Muitas solicitações de envio de e-mail. Aguarde alguns minutos e tente novamente.",
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        {
          error:
            "Não foi possível iniciar a alteração de e-mail. Verifique o endereço informado e tente novamente.",
        },
        { status: 400 }
      );
    }

    safeLog("info", "Solicitação segura de alteração de e-mail enviada via Supabase Auth.");

    return NextResponse.json({
      ok: true,
      pendingEmail: targetEmail,
      message:
        "Solicitação enviada! Verifique sua caixa de entrada (no novo e-mail e no e-mail atual, se a dupla confirmação estiver ativa) e clique no link para concluir a alteração.",
    });
  } catch {
    return NextResponse.json(
      { error: "Erro inesperado ao solicitar alteração de e-mail." },
      { status: 500 }
    );
  }
}
