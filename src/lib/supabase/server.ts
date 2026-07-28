import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Cliente para Server Components, Server Actions e route handlers.
 *
 * Um cliente novo por render, nunca compartilhado entre requisições — ele
 * carrega a sessão de quem está pedindo, então reaproveitar entregaria os dados
 * de um usuário para outro.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.SUPABASE_URL, env.SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component não pode escrever cookie. Quem renova a sessão é o
          // proxy, que roda antes e consegue — então aqui o erro é esperado e
          // ignorá-lo é o comportamento correto, não um remendo.
        }
      },
    },
  });
}

/**
 * Usuário autenticado, ou null.
 *
 * `getUser()` e não `getSession()`: getSession lê o cookie sem validar a
 * assinatura, e no servidor o cookie é dado que o usuário controla. A própria
 * documentação do auth-js marca getSession como inseguro nesse contexto.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
