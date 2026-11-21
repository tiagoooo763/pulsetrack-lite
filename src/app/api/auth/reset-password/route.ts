import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const resetSchema = z.object({
  password: z
    .string()
    .min(8, "A nova senha deve ter no mínimo 8 caracteres.")
    .max(128, "Senha muito longa.")
    .refine(
      (val) => /[a-zA-Z]/.test(val) && /\d/.test(val),
      "A senha deve conter pelo menos uma letra e um número."
    ),
});

export async function POST(request: NextRequest) {
  try {
    const raw = (await request.json()) as { password?: string };
    const parsed = resetSchema.safeParse({ password: raw.password });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Senha inválida." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase Auth não configurado." },
        { status: 503 }
      );
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json(
        {
          error:
            "Link de redefinição expirado ou inválido. Solicite uma nova recuperação de senha.",
        },
        { status: 401 }
      );
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Não foi possível redefinir a senha." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Senha redefinida com sucesso! Você já pode acessar o Dashfy.",
    });
  } catch {
    return NextResponse.json(
      { error: "Erro ao atualizar sua senha." },
      { status: 500 }
    );
  }
}
