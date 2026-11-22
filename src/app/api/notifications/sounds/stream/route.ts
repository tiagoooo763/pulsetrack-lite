import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getUserSoundPreferences } from "@/lib/db";
import {
  readLocalPrivateSoundBuffer,
  verifySignedStreamToken,
} from "@/lib/sound-storage";

/**
 * Entrega segura de áudio privado em ambiente local/testes via token assinado temporário,
 * validando estritamente que o usuário autenticado é o proprietário do arquivo.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const token = request.nextUrl.searchParams.get("token");
  const verified = verifySignedStreamToken(token, user.id);
  if (!verified.valid) {
    return NextResponse.json(
      { error: "URL temporária inválida, expirada ou sem permissão." },
      { status: 403 }
    );
  }

  const buf = readLocalPrivateSoundBuffer(user.id, verified.objectPath);
  if (!buf) {
    return NextResponse.json(
      { error: "Áudio não encontrado." },
      { status: 404 }
    );
  }

  const prefs = await getUserSoundPreferences(user.id);
  const contentType = prefs.customSoundMime || "audio/mpeg";

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
