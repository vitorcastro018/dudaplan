import { cache } from "react";
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
 *
 * Memoizado com `cache()` porque essa segurança tem preço: `getUser()` não
 * decodifica o JWT localmente — ele vai até o GoTrue validar, o que é uma ida
 * à rede inteira por chamada. Sem memoizar, uma navegação fazia de 5 a 7 dessas
 * idas em sequência (layout e página chamam `requireContext`, que chamava esta
 * função e ainda passava por `getContext`, que a chamava de novo), e o atraso
 * aparecia como lentidão a cada clique.
 *
 * `cache()` tem escopo de **uma requisição**: cada requisição memoiza do zero,
 * então nenhuma sessão é reaproveitada entre usuários — o que aqui não é
 * detalhe de performance, é a diferença entre memoizar e vazar sessão.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
