import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { getSigningKeys } from "@/lib/supabase/jwks";
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

/** O essencial que a sessão precisa provar: quem é, e — para a mensagem de erro
 *  de "sem workspace" — qual o e-mail. */
export interface AuthClaims {
  userId: string;
  email?: string;
}

/**
 * Identidade da sessão, verificada, ou null.
 *
 * `getClaims()` e não `getUser()`: as duas validam a assinatura do JWT (então
 * nenhuma abre a brecha do `getSession`, que confia no cookie cru), mas o
 * `getUser` faz isso mandando o token ao GoTrue **a cada chamada** — uma ida à
 * rede inteira por requisição. O `getClaims`, com as chaves públicas em mãos
 * (ver `jwks.ts`), verifica a assinatura localmente, sem rede. Numa navegação
 * que autentica no proxy e de novo no layout, trocar as duas por verificação
 * local é o que tira o atraso de cada clique e de cada troca de página.
 *
 * Em projeto que ainda assina com segredo simétrico (HS256) não há chave
 * pública, e o `getClaims` cai sozinho para o caminho do `getUser` — mesma
 * segurança, mesmo custo de antes, nunca pior.
 *
 * O que se abre mão: o `getUser` confirma no servidor que a conta não foi
 * apagada ou banida no meio da sessão; a verificação local confia no token até
 * ele expirar (~1h) e ser renovado. Para este app é a troca recomendada pelo
 * próprio Supabase, e o proxy renova o token de tempos em tempos.
 *
 * Memoizado com `cache()`, de escopo por requisição: cada requisição memoiza do
 * zero, então nenhuma sessão vaza de um usuário para outro — aqui isso não é
 * detalhe de performance, é a diferença entre memoizar e vazar sessão.
 */
export const getAuthClaims = cache(async (): Promise<AuthClaims | null> => {
  const supabase = await createClient();
  const keys = await getSigningKeys();

  try {
    const { data, error } = await supabase.auth.getClaims(
      undefined,
      keys && keys.length > 0 ? { jwks: { keys } } : undefined,
    );
    if (error || !data?.claims?.sub) return null;
    return { userId: data.claims.sub, email: data.claims.email };
  } catch {
    // JWT ausente, malformado ou não verificável: sessão inválida, trata como
    // deslogado em vez de derrubar o render.
    return null;
  }
});
