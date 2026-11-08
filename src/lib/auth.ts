import crypto from "crypto";
import { cookies } from "next/headers";
import { getServerSetting } from "./db";

export const SESSION_COOKIE_NAME = "pulsetrack_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

function getSigningSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.OMEGAPAY_SECRET_KEY?.trim() ||
    "pulsetrack-lite-local-hmac-secret-key-2026"
  );
}

export async function getExpectedDashboardCredentials(): Promise<{
  username: string;
  password: string;
  isDefaultPassword: boolean;
}> {
  const envUser = process.env.DASHBOARD_USER?.trim() || "admin";
  const envPass = process.env.DASHBOARD_PASSWORD?.trim();
  const dbPass = (await getServerSetting("DASHBOARD_PASSWORD"))?.trim();

  const password = envPass || dbPass || "pulsetrack123";
  const isDefaultPassword = !envPass && !dbPass;

  return {
    username: envUser,
    password,
    isDefaultPassword,
  };
}

export function createSessionToken(username: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${username}.${expiresAt}`;
  const signature = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): {
  valid: boolean;
  username?: string;
} {
  if (!token) return { valid: false };
  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false };

  const [username, expiresAtStr, signature] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return { valid: false };
  }

  const payload = `${username}.${expiresAtStr}`;
  const expectedSig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("hex");

  const sigBuf = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");

  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return { valid: false };
  }

  return { valid: true, username };
}

export function timingSafeStringCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a, "utf8").digest();
  const hashB = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token).valid;
}
