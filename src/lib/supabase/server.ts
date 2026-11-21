import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAnonKey, getSupabaseUrl } from "./config";

/**
 * Cria um cliente Supabase Auth para Server Components e Route Handlers.
 * Sempre use `supabase.auth.getUser()` (nunca apenas `getSession()`) para validar o JWT no servidor.
 */
export async function createSupabaseServerClient() {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components são somente leitura para cookies; o middleware atualiza quando necessário.
        }
      },
    },
  });
}
