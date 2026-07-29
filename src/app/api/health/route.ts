import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Healthcheck do container.
 *
 * Por padrão responde só "o servidor Next está atendendo", sem tocar no
 * Supabase. Com `?deep=1`, também verifica a Data API.
 *
 * A separação existe porque o healthcheck do compose decide se o proxy roteia
 * o domínio para este container. Amarrá-lo a um serviço externo significa que
 * qualquer instabilidade do Supabase tira o app do ar inteiro, em vez de
 * degradar só o que depende de dados.
 *
 * A versão anterior consultava a tabela `workspaces`, e isso nunca funcionou:
 * sem sessão a requisição vale como papel `anon`, e a migration de RLS revoga
 * todo privilégio de `anon` nas tabelas do DudaPlan. O PostgREST respondia
 * "permission denied", este endpoint devolvia 503 para sempre, o container
 * ficava `unhealthy` e o domínio não chegava nele — o app subia e ficava
 * inalcançável.
 *
 * A checagem profunda usa a raiz da Data API, que não depende de GRANT em
 * tabela nenhuma e separa os dois erros que importam: URL errada ou projeto
 * fora do ar não respondem; chave errada responde 401.
 */
export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("deep") !== "1") {
    return NextResponse.json({ status: "ok" });
  }

  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${env.SUPABASE_KEY}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          status: "error",
          supabase:
            response.status === 401
              ? "Supabase recusou a chave (401). Confira SUPABASE_PUBLISHABLE_KEY."
              : `Supabase respondeu ${response.status}.`,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ status: "ok", supabase: "ok" });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        supabase: `Não foi possível alcançar ${env.SUPABASE_URL}: ${
          error instanceof Error ? error.message : "erro desconhecido"
        }`,
      },
      { status: 503 },
    );
  }
}
