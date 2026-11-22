import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getUserSoundPreferences,
  resetUserSoundPreferences,
  upsertUserSoundPreferences,
} from "@/lib/db";
import { createSignedUserSoundUrl } from "@/lib/sound-storage";
import {
  DEFAULT_SOUND_PREFERENCES,
  type NotificationSoundId,
} from "@/lib/notification-sounds";

const updateSoundPrefsSchema = z.object({
  action: z.enum(["update", "reset_defaults"]).optional().default("update"),
  soundEnabled: z.boolean().optional(),
  selectedSound: z
    .enum([
      "cash_register",
      "coins",
      "classic_bell",
      "soft_notification",
      "custom",
      "silent",
    ])
    .optional(),
  soundVolume: z.number().min(0).max(100).optional(),
});

/**
 * Retorna as preferências sonoras do usuário autenticado (padrão: cash_register, 70%)
 * + URL temporária assinada do som personalizado (se houver).
 */
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const preferences = await getUserSoundPreferences(user.id);
  const customSignedUrl = preferences.customSoundPath
    ? await createSignedUserSoundUrl({
        userId: user.id,
        objectPath: preferences.customSoundPath,
      })
    : null;

  return NextResponse.json({
    ok: true,
    preferences,
    customSignedUrl,
    defaults: DEFAULT_SOUND_PREFERENCES,
  });
}

/**
 * Atualiza ou restaura as preferências sonoras do usuário autenticado.
 */
export async function PUT(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const raw = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const parsed = updateSoundPrefsSchema.safeParse({
      action: raw.action,
      soundEnabled:
        typeof raw.soundEnabled === "boolean" ? raw.soundEnabled : undefined,
      selectedSound: raw.selectedSound,
      soundVolume:
        raw.soundVolume !== undefined ? Number(raw.soundVolume) : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error:
            parsed.error.issues[0]?.message ||
            "Parâmetros de som inválidos.",
        },
        { status: 400 }
      );
    }

    if (parsed.data.action === "reset_defaults") {
      const reset = await resetUserSoundPreferences(user.id);
      const customSignedUrl = reset.customSoundPath
        ? await createSignedUserSoundUrl({
            userId: user.id,
            objectPath: reset.customSoundPath,
          })
        : null;
      return NextResponse.json({
        ok: true,
        preferences: reset,
        customSignedUrl,
        message: "Configurações de som restauradas para o padrão (Caixa registradora, 70%).",
      });
    }

    const current = await getUserSoundPreferences(user.id);
    if (parsed.data.selectedSound === "custom" && !current.customSoundPath) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Envie um arquivo de áudio personalizado antes de selecionar 'Som personalizado'.",
        },
        { status: 400 }
      );
    }

    const updated = await upsertUserSoundPreferences(user.id, {
      soundEnabled: parsed.data.soundEnabled,
      selectedSound: parsed.data.selectedSound as
        | NotificationSoundId
        | undefined,
      soundVolume: parsed.data.soundVolume,
    });

    const customSignedUrl = updated.customSoundPath
      ? await createSignedUserSoundUrl({
          userId: user.id,
          objectPath: updated.customSoundPath,
        })
      : null;

    return NextResponse.json({
      ok: true,
      preferences: updated,
      customSignedUrl,
      message: "Preferências de som salvas com sucesso.",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Erro ao salvar preferências de som." },
      { status: 500 }
    );
  }
}
