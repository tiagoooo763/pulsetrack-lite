import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getUserSoundPreferences,
  upsertUserSoundPreferences,
} from "@/lib/db";
import {
  DEFAULT_SOUND_PREFERENCES,
  validateUploadedAudioFile,
} from "@/lib/notification-sounds";
import {
  createSignedUserSoundUrl,
  deletePrivateUserSound,
  uploadPrivateUserSound,
} from "@/lib/sound-storage";
import { safeLog } from "@/lib/sanitize";

/**
 * Gera URL temporária autorizada (TTL curto) exclusivamente para o áudio do usuário autenticado.
 */
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const prefs = await getUserSoundPreferences(user.id);
  if (!prefs.customSoundPath) {
    return NextResponse.json(
      { ok: false, error: "Nenhum áudio personalizado cadastrado nesta conta." },
      { status: 404 }
    );
  }

  const signedUrl = await createSignedUserSoundUrl({
    userId: user.id,
    objectPath: prefs.customSoundPath,
  });

  if (!signedUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: "Arquivo de áudio personalizado indisponível no momento.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    signedUrl,
    fileName: prefs.customSoundName,
  });
}

/**
 * Upload seguro de áudio personalizado (MP3, WAV, OGG até 2 MB).
 * Valida extensão, magic bytes reais e tamanho no backend e armazena no bucket privado por usuário.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const entry = formData.get("file");

    if (!entry || !(entry instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Selecione um arquivo de áudio (MP3, WAV ou OGG)." },
        { status: 400 }
      );
    }

    const arrayBuffer = await entry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const validation = validateUploadedAudioFile({
      fileName: entry.name,
      declaredMime: entry.type,
      buffer,
    });

    if (!validation.ok) {
      return NextResponse.json(
        { ok: false, error: validation.error },
        { status: 400 }
      );
    }

    const current = await getUserSoundPreferences(user.id);
    const uploaded = await uploadPrivateUserSound({
      userId: user.id,
      buffer,
      ext: validation.ext,
      mimeType: validation.mimeType,
      previousPath: current.customSoundPath,
    });

    const updated = await upsertUserSoundPreferences(user.id, {
      customSoundPath: uploaded.objectPath,
      customSoundName: validation.safeFileName,
      customSoundMime: validation.mimeType,
      selectedSound: "custom",
    });

    const signedUrl = await createSignedUserSoundUrl({
      userId: user.id,
      objectPath: uploaded.objectPath,
    });

    safeLog("info", "Áudio personalizado de notificação salvo com segurança.", {
      ext: validation.ext,
      sizeBytes: buffer.length,
      backend: uploaded.storageBackend,
    });

    return NextResponse.json(
      {
        ok: true,
        preferences: updated,
        customSignedUrl: signedUrl,
        message: `Áudio "${validation.safeFileName}" enviado e vinculado à sua conta.`,
      },
      { status: 201 }
    );
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Erro inesperado ao enviar o áudio personalizado.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * Exclui o áudio personalizado do usuário autenticado e volta ao padrão se 'custom' estava ativo.
 */
export async function DELETE() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const current = await getUserSoundPreferences(user.id);
    if (current.customSoundPath) {
      await deletePrivateUserSound({
        userId: user.id,
        objectPath: current.customSoundPath,
      });
    }

    const nextSelected =
      current.selectedSound === "custom"
        ? DEFAULT_SOUND_PREFERENCES.selectedSound
        : current.selectedSound;

    const updated = await upsertUserSoundPreferences(user.id, {
      customSoundPath: null,
      customSoundName: null,
      customSoundMime: null,
      selectedSound: nextSelected,
    });

    return NextResponse.json({
      ok: true,
      preferences: updated,
      customSignedUrl: null,
      message: "Áudio personalizado excluído com sucesso.",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Erro ao excluir o áudio personalizado." },
      { status: 500 }
    );
  }
}
