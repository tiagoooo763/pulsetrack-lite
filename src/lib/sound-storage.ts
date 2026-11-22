import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "./supabase/server";
import { getSupabaseUrl } from "./supabase/config";
import { safeLog } from "./sanitize";
import type { AllowedSoundExtension } from "./notification-sounds";

export const SOUNDS_STORAGE_BUCKET = "user-notification-sounds";
const LOCAL_PREFIX = "local:";
const SIGNED_STREAM_TTL_SEC = 120;

function getStreamSigningSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.TIKTOK_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "dashfy-local-sound-stream-secret"
  );
}

export function sanitizeUserStorageFolder(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

/**
 * Garante que um `objectPath` pertence estritamente ao `userId` informado (anti-IDOR / anti-path-traversal).
 */
export function isSoundPathOwnedByUser(
  objectPath: string | null | undefined,
  userId: string
): boolean {
  if (!objectPath || !userId) return false;
  const raw = objectPath.startsWith(LOCAL_PREFIX)
    ? objectPath.slice(LOCAL_PREFIX.length)
    : objectPath;
  if (raw.includes("..") || raw.includes("\\")) return false;

  const exactPrefix = `${userId}/`;
  const safePrefix = `${sanitizeUserStorageFolder(userId)}/`;
  return raw.startsWith(exactPrefix) || raw.startsWith(safePrefix);
}

function getLocalStorageRoot(): string {
  return path.resolve(process.cwd(), "data", "private-sounds");
}

function resolveLocalFilePath(objectPath: string): string | null {
  if (!objectPath.startsWith(LOCAL_PREFIX)) return null;
  const rel = objectPath.slice(LOCAL_PREFIX.length);
  if (!rel || rel.includes("..") || rel.includes("\\")) return null;
  const root = getLocalStorageRoot();
  const full = path.resolve(root, rel);
  if (!full.startsWith(root)) return null;
  return full;
}

async function getSupabaseStorageClient() {
  const url = getSupabaseUrl();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  // Em produção com sessão Supabase Auth, usa o cliente autenticado do usuário (respeitando Storage RLS!)
  const authClient = await createSupabaseServerClient();
  if (authClient) {
    const { data } = await authClient.auth.getUser().catch(() => ({ data: { user: null } }));
    if (data?.user) {
      return authClient;
    }
  }

  // Fallback opcional server-only caso a conta proprietária legada use Supabase Storage com service role
  if (url && serviceKey) {
    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return null;
}

export interface SignedStreamTokenPayload {
  uid: string;
  p: string;
  exp: number;
}

export function createSignedStreamToken(
  userId: string,
  objectPath: string,
  expiresInSeconds = SIGNED_STREAM_TTL_SEC
): string {
  const payload: SignedStreamTokenPayload = {
    uid: userId,
    p: objectPath,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", getStreamSigningSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifySignedStreamToken(
  token: string | null | undefined,
  expectedUserId: string
): { valid: true; objectPath: string } | { valid: false } {
  if (!token || !token.includes(".")) return { valid: false };
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return { valid: false };

  const expectedSig = crypto
    .createHmac("sha256", getStreamSigningSecret())
    .update(encoded)
    .digest("base64url");

  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as SignedStreamTokenPayload;
    if (
      parsed.uid !== expectedUserId ||
      !parsed.exp ||
      parsed.exp < Math.floor(Date.now() / 1000) ||
      !isSoundPathOwnedByUser(parsed.p, expectedUserId)
    ) {
      return { valid: false };
    }
    return { valid: true, objectPath: parsed.p };
  } catch {
    return { valid: false };
  }
}

/**
 * Faz upload privado do áudio personalizado no Supabase Storage (bucket privado `user-notification-sounds`)
 * sob a pasta exclusiva do proprietário (`<user_id>/custom-<ts>.<ext>`).
 * Em ambiente local/testes sem Supabase Storage acessível, usa armazenamento privado local com URLs assinadas.
 */
export async function uploadPrivateUserSound(input: {
  userId: string;
  buffer: Buffer;
  ext: AllowedSoundExtension;
  mimeType: "audio/mpeg" | "audio/wav" | "audio/ogg";
  previousPath?: string | null;
}): Promise<{ objectPath: string; storageBackend: "supabase" | "local" }> {
  const folder = input.userId.includes(":")
    ? sanitizeUserStorageFolder(input.userId)
    : input.userId;
  const fileName = `custom-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${input.ext}`;
  const storagePath = `${folder}/${fileName}`;

  const supabase = await getSupabaseStorageClient();
  if (supabase) {
    const { error } = await supabase.storage
      .from(SOUNDS_STORAGE_BUCKET)
      .upload(storagePath, input.buffer, {
        contentType: input.mimeType,
        upsert: true,
      });

    if (!error) {
      if (
        input.previousPath &&
        input.previousPath !== storagePath &&
        isSoundPathOwnedByUser(input.previousPath, input.userId)
      ) {
        await deletePrivateUserSound({
          userId: input.userId,
          objectPath: input.previousPath,
        }).catch(() => {});
      }
      return { objectPath: storagePath, storageBackend: "supabase" };
    }

    safeLog("warn", "Falha ao enviar áudio para Supabase Storage.", {
      reason: error.message,
    });

    // Em produção (Vercel serverless), exige Supabase Storage configurado — não usa disco efêmero
    if (process.env.VERCEL) {
      throw new Error(
        "Não foi possível armazenar o áudio no Supabase Storage. Verifique se o bucket privado 'user-notification-sounds' foi criado."
      );
    }
  } else if (process.env.VERCEL) {
    throw new Error(
      "Upload de som personalizado requer sessão autenticada no Supabase Auth e bucket privado 'user-notification-sounds'."
    );
  }

  // Fallback local/testes fora da Vercel
  const localObjectPath = `${LOCAL_PREFIX}${sanitizeUserStorageFolder(input.userId)}/${fileName}`;
  const fullPath = resolveLocalFilePath(localObjectPath);
  if (!fullPath) {
    throw new Error("Caminho de armazenamento local inválido.");
  }

  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, input.buffer);

  if (
    input.previousPath &&
    input.previousPath !== localObjectPath &&
    isSoundPathOwnedByUser(input.previousPath, input.userId)
  ) {
    await deletePrivateUserSound({
      userId: input.userId,
      objectPath: input.previousPath,
    }).catch(() => {});
  }

  return { objectPath: localObjectPath, storageBackend: "local" };
}

/**
 * Gera URL temporária autorizada (TTL curto de 120s) somente se o arquivo pertencer ao `userId`.
 */
export async function createSignedUserSoundUrl(input: {
  userId: string;
  objectPath: string | null | undefined;
  expiresInSeconds?: number;
}): Promise<string | null> {
  if (!input.objectPath || !isSoundPathOwnedByUser(input.objectPath, input.userId)) {
    return null;
  }

  const ttl = input.expiresInSeconds ?? SIGNED_STREAM_TTL_SEC;

  if (input.objectPath.startsWith(LOCAL_PREFIX)) {
    const full = resolveLocalFilePath(input.objectPath);
    if (!full || !fs.existsSync(full)) return null;
    const token = createSignedStreamToken(input.userId, input.objectPath, ttl);
    return `/api/notifications/sounds/stream?token=${encodeURIComponent(token)}`;
  }

  const supabase = await getSupabaseStorageClient();
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from(SOUNDS_STORAGE_BUCKET)
    .createSignedUrl(input.objectPath, ttl);

  if (error || !data?.signedUrl) {
    safeLog("warn", "Falha ao gerar URL assinada temporária de áudio no Storage.", {
      reason: error?.message || "missing_url",
    });
    return null;
  }

  return data.signedUrl;
}

/**
 * Exclui áudio privado verificando estritamente propriedade do `userId`.
 */
export async function deletePrivateUserSound(input: {
  userId: string;
  objectPath: string | null | undefined;
}): Promise<boolean> {
  if (!input.objectPath || !isSoundPathOwnedByUser(input.objectPath, input.userId)) {
    return false;
  }

  if (input.objectPath.startsWith(LOCAL_PREFIX)) {
    const full = resolveLocalFilePath(input.objectPath);
    if (full && fs.existsSync(full)) {
      fs.unlinkSync(full);
    }
    return true;
  }

  const supabase = await getSupabaseStorageClient();
  if (!supabase) return false;

  const { error } = await supabase.storage
    .from(SOUNDS_STORAGE_BUCKET)
    .remove([input.objectPath]);

  return !error;
}

export function readLocalPrivateSoundBuffer(
  userId: string,
  objectPath: string
): Buffer | null {
  if (!isSoundPathOwnedByUser(objectPath, userId)) return null;
  const full = resolveLocalFilePath(objectPath);
  if (!full || !fs.existsSync(full)) return null;
  return fs.readFileSync(full);
}
