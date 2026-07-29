import { env } from "@/lib/env";
import type { JWK } from "@supabase/auth-js";

/**
 * As chaves públicas com que o Supabase assina os JWTs, em cache no processo.
 *
 * Por que existe: `getClaims()` verifica a assinatura do token **localmente**
 * quando tem as chaves em mãos, sem a ida à rede que o `getUser()` faz a cada
 * chamada. Só que o cache de JWKS do supabase-js mora na instância do cliente,
 * e este app cria um cliente por requisição (obrigatório — cada um carrega o
 * cookie de quem está pedindo). Sem um cache aqui fora, a primeira verificação
 * de cada requisição buscaria o JWKS de novo, e a ida à rede que se queria
 * cortar voltaria pela janela.
 *
 * Guardar num `let` de módulo resolve: o processo do Next é longevo, então as
 * chaves sobrevivem entre requisições. Elas quase nunca giram, e o TTL cobre a
 * rotação — quando ela acontecer, `getClaims` não acha o `kid` na lista que
 * passamos e busca sozinho o conjunto novo, então uma chave velha aqui nunca
 * trava login, só custa uma verificação via rede até o cache renovar.
 */
let cached: { keys: JWK[]; fetchedAt: number } | null = null;
const TTL_MS = 10 * 60 * 1000;

export async function getSigningKeys(): Promise<JWK[] | undefined> {
  const now = Date.now();
  if (cached && now - cached.fetchedAt < TTL_MS) return cached.keys;

  try {
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`, {
      headers: { apikey: env.SUPABASE_KEY },
    });
    if (!response.ok) return cached?.keys;

    const data = (await response.json()) as { keys?: JWK[] };
    // Lista vazia é a resposta de um projeto que ainda assina com segredo
    // simétrico (HS256): não há chave pública para verificar local, e o
    // `getClaims` cai para o `getUser` de qualquer jeito. Guardo mesmo assim,
    // com o mesmo TTL, para não refazer esta busca a cada requisição.
    const keys = data.keys ?? [];
    cached = { keys, fetchedAt: now };
    return keys;
  } catch {
    // Rede indisponível: devolve o que houver em cache (ainda que vencido) e
    // deixa o `getClaims` seguir pelo seu próprio caminho. Nunca lança —
    // derrubar a verificação de sessão por causa do JWKS seria pior que o
    // atraso que este cache evita.
    return cached?.keys;
  }
}
