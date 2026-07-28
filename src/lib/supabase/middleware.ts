import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

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
 * (para o `getUser()` logo abaixo enxergar a sessão nova) **e** para a resposta
 * (para o navegador guardar). Escrever só num dos dois "funciona" nos testes e
 * derruba a sessão em produção.
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
