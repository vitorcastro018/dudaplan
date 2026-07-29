import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { getSigningKeys } from "@/lib/supabase/jwks";

/**
 * Renova a sessão e devolve a resposta com os cookies atualizados.
 *
 * Precisa existir: Server Components não conseguem escrever cookie, então sem
 * este passo o refresh token nunca é gravado de volta e a sessão morre sozinha
 * depois de uma hora. A documentação do `@supabase/ssr` é direta sobre isso —
 * `getAll`/`setAll` implementados errado causam logout aleatório e erro difícil
 * de rastrear.
 *
 * O detalhe que quebra silenciosamente: os cookies têm que ir para a requisição
 * (para a verificação logo abaixo enxergar a sessão nova) **e** para a resposta
 * (para o navegador guardar). Escrever só num dos dois "funciona" nos testes e
 * derruba a sessão em produção.
 *
 * `getClaims()` e não `getUser()` para checar a sessão: as duas validam a
 * assinatura do JWT, mas o `getUser` manda o token ao GoTrue a cada requisição,
 * e o proxy roda em **toda** navegação — era uma ida à rede inteira por página.
 * Com as chaves públicas em cache (`jwks.ts`) a verificação é local. O refresh
 * do token continua acontecendo: o `getClaims` chama `getSession` por baixo, que
 * renova quando está perto de expirar e dispara o `setAll` acima. Ver a nota
 * mais longa em `getAuthClaims`, em `server.ts`.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const keys = await getSigningKeys();
  let authenticated = false;
  try {
    const { data, error } = await supabase.auth.getClaims(
      undefined,
      keys && keys.length > 0 ? { jwks: { keys } } : undefined,
    );
    authenticated = !error && !!data?.claims?.sub;
  } catch {
    authenticated = false;
  }

  return { response, authenticated };
}
