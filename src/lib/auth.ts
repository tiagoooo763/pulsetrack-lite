import crypto from "crypto";
import { cookies } from "next/headers";
import {
  claimLegacyDataForOwner,
  ensureUserProfile,
  getServerSetting,
  LEGACY_ADMIN_USER_ID,
} from "./db";
import { createSupabaseServerClient } from "./supabase/server";

export const SESSION_COOKIE_NAME = "pulsetrack_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  companyName: string;
  authProvider: "supabase" | "legacy";
}

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
  const envUser = process.env.DASHBOARD_USER?.trim() || "mendoncat831@gmail.com";
  const envPass = process.env.DASHBOARD_PASSWORD?.trim();
  const dbPass = (await getServerSetting("DASHBOARD_PASSWORD"))?.trim();

  const password = envPass || dbPass || "@Tiago2507";
  const isDefaultPassword = !envPass && !dbPass;

  return {
    username: envUser,
    password,
    isDefaultPassword,
  };
}

export function createSessionToken(username: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const safeUser = encodeURIComponent(username.trim().toLowerCase());
  const payload = `${safeUser}|${expiresAt}`;
  const signature = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("hex");
  return `${payload}|${signature}`;
}

export function verifySessionToken(token: string | undefined | null): {
  valid: boolean;
  username?: string;
} {
  if (!token) return { valid: false };
  const rawToken = token.trim();
  const parts = rawToken.split("|");
  if (parts.length !== 3) return { valid: false };

  const [safeUser, expiresAtStr, signature] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return { valid: false };
  }

  const payload = `${safeUser}|${expiresAtStr}`;
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

  return { valid: true, username: decodeURIComponent(safeUser) };
}

export function timingSafeStringCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a, "utf8").digest();
  const hashB = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Valida a sessão no servidor (Supabase Auth prioritário + fallback seguro da conta legada).
 * Garante criação automática de perfil sem duplicatas e preserva dados existentes da conta proprietária.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  // 1. Tenta autenticar via Supabase Auth (JWT verificado no servidor com getUser())
  try {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        const email = (data.user.email || "").trim().toLowerCase();
        const meta = (data.user.user_metadata || {}) as Record<string, unknown>;
        const metaName =
          (typeof meta.display_name === "string" && meta.display_name) ||
          (typeof meta.full_name === "string" && meta.full_name) ||
          (typeof meta.name === "string" && meta.name) ||
          undefined;
        const metaCompany =
          typeof meta.company_name === "string" ? meta.company_name : undefined;

        const profile = await ensureUserProfile({
          id: data.user.id,
          email,
          displayName: metaName,
          companyName: metaCompany,
        });

        await claimLegacyDataForOwner(data.user.id, email);

        return {
          id: data.user.id,
          email: profile.email || email,
          displayName: profile.displayName || email.split("@")[0] || "Usuário",
          companyName: profile.companyName || "Dashfy Workspace",
          authProvider: "supabase",
        };
      }
    }
  } catch {
    // Fallback para sessão legada abaixo
  }

  // 2. Fallback compatível para a sessão legada HMAC da conta proprietária
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const verified = verifySessionToken(token);
    if (verified.valid && verified.username) {
      const profile = await ensureUserProfile({
        id: LEGACY_ADMIN_USER_ID,
        email: verified.username,
        displayName: "Tiago Mendonça",
        companyName: "Dashfy Workspace",
        role: "owner",
      });
      return {
        id: LEGACY_ADMIN_USER_ID,
        email: verified.username,
        displayName: profile.displayName || "Tiago Mendonça",
        companyName: profile.companyName || "Dashfy Workspace",
        authProvider: "legacy",
      };
    }
  } catch {
    // Sem cookies válidos
  }

  return null;
}

export async function isAuthenticated(): Promise<boolean> {
  return Boolean(await getAuthenticatedUser());
}
