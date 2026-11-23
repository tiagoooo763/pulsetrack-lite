import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";

/**
 * Middleware otimizado para renovação de sessão Supabase Auth:
 * - Não executa chamadas externas ao Supabase Auth para visitantes sem cookies `sb-*`.
 * - Não duplica validação nas rotas `/api/*` (que já validam `getAuthenticatedUser()` no servidor).
 * - Mantém rotas públicas estáticas e assets sem overhead.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const allCookies = request.cookies.getAll();
  const hasSupabaseAuthCookie = allCookies.some(
    (c) => c.name.startsWith("sb-") && c.name.includes("auth-token")
  );

  // Sem cookie de sessão Supabase -> retorna imediatamente sem latência de rede
  if (!hasSupabaseAuthCookie) {
    return response;
  }

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    return response;
  }

  let updatedResponse = response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        updatedResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          updatedResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  try {
    await supabase.auth.getUser();
  } catch {
    // Falha silenciosa em caso de rede offline; rotas protegidas validam novamente no servidor.
  }

  return updatedResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|assets/|sounds/|api/|privacidade|politica-de-privacidade|termos|termos-de-uso|robots.txt|sitemap.xml).*)",
  ],
};
