import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import {
  getPublicAppUrl,
  isSupabaseAuthConfigured,
} from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const forgotSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido.").max(140),
});

export async function POST(request: NextRequest) {
  try {
    const ip = extractClientIp(request.headers);
    const raw = (await request.json()) as { email?: string };
    const email = (raw.email || "").trim().toLowerCase();

    const ipLimit = checkRateLimit({
      key: `forgot:ip:${ip}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    const emailLimit = checkRateLimit({
      key: `forgot:email:${email}`,
      limit: 3,
      windowMs: 15 * 60 * 1000,
    });

    if (!ipLimit.allowed || !emailLimit.allowed) {
      const retry = Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds);
      return NextResponse.json(
        {
          error: `Muitas solicitações de recuperação. Aguarde ${Math.ceil(retry / 60)} minuto(s).`,
        },
        { status: 429, headers: { "Retry-After": String(retry) } }
      );
    }

    const parsed = forgotSchema.safeParse({ email });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "E-mail inválido." },
        { status: 400 }
      );
    }

    if (!isSupabaseAuthConfigured()) {
      return NextResponse.json(
        {
          error:
            "Recuperação de senha requer NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY configuradas.",
        },
        { status: 503 }
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
    const redirectTo = `${appUrl}/auth/callback?next=/redefinir-senha`;

    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo,
    });

    // Mensagem neutra para não vazar quais e-mails existem no sistema
    return NextResponse.json({
      ok: true,
      message:
        "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha em instantes.",
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível enviar o e-mail de recuperação." },
      { status: 500 }
    );
  }
}
