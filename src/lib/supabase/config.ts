/**
 * Configuração centralizada do Supabase Auth para a Dashfy.
 * Aproveita o projeto Supabase atual sem criar outro banco de dados.
 */

export const DEFAULT_VERCEL_APP_URL = "https://www.usedashfy.com.br";

export function getSupabaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");

  // Deriva a URL pública do projeto Supabase se DATABASE_URL apontar para supabase.co
  const dbUrl = process.env.DATABASE_URL?.trim() || "";
  const poolerMatch = dbUrl.match(/postgres\.([a-z0-9]+):/i);
  if (poolerMatch?.[1]) {
    return `https://${poolerMatch[1]}.supabase.co`;
  }
  const directMatch = dbUrl.match(/@db\.([a-z0-9]+)\.supabase\.co/i);
  if (directMatch?.[1]) {
    return `https://${directMatch[1]}.supabase.co`;
  }

  return "";
}

export function getSupabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    ""
  );
}

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

/**
 * Resolve a URL pública da aplicação para redirecionamentos seguros
 * de confirmação de e-mail e recuperação de senha (Vercel e desenvolvimento local).
 */
export function getPublicAppUrl(requestOrigin?: string | null): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  if (requestOrigin && /^https?:\/\//i.test(requestOrigin)) {
    return requestOrigin.replace(/\/+$/, "");
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "")}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "")}`;
  }

  return DEFAULT_VERCEL_APP_URL;
}
