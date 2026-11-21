import crypto from "crypto";

const ENC_PREFIX = "enc:v1:";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutos
export const TIKTOK_OAUTH_NONCE_COOKIE = "dashfy_tiktok_oauth_nonce";

function getMasterKeyBuffer(): Buffer {
  const rawKey =
    process.env.TIKTOK_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.TIKTOK_APP_SECRET?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "dashfy-dev-fallback-encryption-key";

  // Se já vier como 64 hex chars (32 bytes exatos), usa diretamente
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, "hex");
  }

  return crypto.createHash("sha256").update(rawKey, "utf8").digest();
}

function getOAuthStateSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.TIKTOK_APP_SECRET?.trim() ||
    process.env.TIKTOK_TOKEN_ENCRYPTION_KEY?.trim() ||
    "dashfy-tiktok-oauth-state-secret"
  );
}

/**
 * Criptografa tokens OAuth em repouso utilizando AES-256-GCM.
 */
export function encryptSecret(plaintext: string): string {
  const key = getMasterKeyBuffer();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

/**
 * Descriptografa tokens OAuth armazenados no banco de dados.
 */
export function decryptSecret(stored: string): string {
  if (!stored || !stored.startsWith(ENC_PREFIX)) {
    throw new Error("Formato de token criptografado inválido.");
  }
  const rest = stored.slice(ENC_PREFIX.length);
  const parts = rest.split(".");
  if (parts.length !== 3) {
    throw new Error("Payload criptografado corrompido.");
  }

  const [ivB64, tagB64, dataB64] = parts;
  const key = getMasterKeyBuffer();
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

interface OAuthStatePayload {
  uid: string;
  did: string;
  lbl?: string;
  n: string;
  exp: number;
}

/**
 * Gera um parâmetro `state` assinado com HMAC-SHA256 vinculado ao usuário autenticado
 * e um `nonce` separado que deve ser gravado em cookie HttpOnly.
 */
export function createTikTokOAuthState(input: {
  userId: string;
  dashboardId?: string;
  label?: string;
  nowMs?: number;
}): { state: string; nonce: string } {
  const nonce = crypto.randomBytes(18).toString("base64url");
  const payload: OAuthStatePayload = {
    uid: input.userId,
    did: (input.dashboardId || "tiktok").trim().slice(0, 60) || "tiktok",
    lbl: input.label?.trim().slice(0, 80) || undefined,
    n: nonce,
    exp: (input.nowMs ?? Date.now()) + STATE_TTL_MS,
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", getOAuthStateSecret())
    .update(encoded)
    .digest("base64url");

  return {
    state: `${encoded}.${sig}`,
    nonce,
  };
}

export type VerifyOAuthStateResult =
  | { valid: true; dashboardId: string; label?: string }
  | { valid: false; reason: string };

/**
 * Valida assinatura HMAC, validade temporal, vínculo com o `userId` autenticado
 * e correspondência com o cookie `HttpOnly` de nonce (proteção anti-CSRF).
 */
export function verifyTikTokOAuthState(input: {
  state: string | null | undefined;
  expectedUserId: string;
  cookieNonce: string | null | undefined;
  nowMs?: number;
}): VerifyOAuthStateResult {
  if (!input.state || !input.state.includes(".")) {
    return { valid: false, reason: "Parâmetro state ausente ou malformado." };
  }
  if (!input.cookieNonce) {
    return {
      valid: false,
      reason:
        "Sessão OAuth expirada ou cookie de segurança ausente. Inicie a conexão novamente.",
    };
  }

  const [encoded, receivedSig] = input.state.split(".");
  if (!encoded || !receivedSig) {
    return { valid: false, reason: "Parâmetro state inválido." };
  }

  const expectedSig = crypto
    .createHmac("sha256", getOAuthStateSecret())
    .update(encoded)
    .digest("base64url");

  const sigA = Buffer.from(receivedSig, "utf8");
  const sigB = Buffer.from(expectedSig, "utf8");
  if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
    return {
      valid: false,
      reason: "Assinatura de segurança (state) inválida.",
    };
  }

  let parsed: OAuthStatePayload;
  try {
    parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as OAuthStatePayload;
  } catch {
    return { valid: false, reason: "Payload de state inválido." };
  }

  const now = input.nowMs ?? Date.now();
  if (!parsed.exp || now > parsed.exp) {
    return {
      valid: false,
      reason: "Solicitação de autorização expirada. Tente conectar novamente.",
    };
  }

  if (parsed.uid !== input.expectedUserId) {
    return {
      valid: false,
      reason:
        "O fluxo OAuth não pertence ao usuário autenticado na sessão atual.",
    };
  }

  const nonceA = Buffer.from(parsed.n || "", "utf8");
  const nonceB = Buffer.from(input.cookieNonce, "utf8");
  if (
    nonceA.length === 0 ||
    nonceA.length !== nonceB.length ||
    !crypto.timingSafeEqual(nonceA, nonceB)
  ) {
    return {
      valid: false,
      reason: "Falha na verificação anti-CSRF (nonce divergente).",
    };
  }

  return {
    valid: true,
    dashboardId: parsed.did || "tiktok",
    label: parsed.lbl,
  };
}
