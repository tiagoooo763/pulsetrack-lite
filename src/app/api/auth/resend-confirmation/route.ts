import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limit";
import {
  getPublicAppUrl,
  isSupabaseAuthConfigured,
} from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const resendSchema = z.object({
  email: z.string().trim().email("Informe um endereço de e-mail válido.").max(140),
});

/**
 * Reenvia o e-mail de confirmação de cadastro via Supabase Auth (com rate limit).
 */
export async function POST(request: NextRequest) {
  try {
    const ip = extractClientIp(request.headers);
    const raw = (await request.json().catch(() => ({}))) as { email?: string };
    const email = (raw.email || "").trim().toLowerCase();

    const parsed = resendSchema.safeParse({ email });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "E-mail inválido." },
        { status: 400 }
      );
    }

    const limit = checkRateLimit({
      key: `resend-confirm:${ip}:${email}`,
      limit: 3,
      windowMs: 15 * 60 * 1000,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: `Muitos pedidos de reenvio. Aguarde ${Math.ceil(limit.retryAfterSeconds / 60)} minuto(s) e tente novamente.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        }
      );
    }

    if (!isSupabaseAuthConfigured()) {
      return NextResponse.json(
        { error: "Serviço de autenticação indisponível." },
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

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: parsed.data.email,
      options: {
        emailRedirectTo: `${appUrl}/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("rate limit") || error.status === 429) {
        return NextResponse.json(
          {
            error:
              "Limite de reenvio atingido. Aguarde alguns minutos e tente novamente.",
          },
          { status: 429 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      message:
        "Se o cadastro estiver pendente de confirmação, reenviamos um novo link para sua caixa de entrada.",
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível reenviar o e-mail de confirmação." },
      { status: 500 }
    );
  }
}
