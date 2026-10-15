import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Por padrão responde só "o servidor Next está atendendo", sem tocar no banco.
 * Com `?deep=1`, também faz um `select 1` no Postgres.
 *
 * A separação existe porque o healthcheck do compose decide se o proxy roteia
 * o domínio para este container. Amarrá-lo ao banco significa que qualquer
 * instabilidade dele tira o app do ar inteiro, em vez de degradar só o que
 * depende de dados.
 */
export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("deep") !== "1") {
    return NextResponse.json({ status: "ok" });
  }

  try {
    await query("select 1");
    return NextResponse.json({ status: "ok", database: "ok" });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        database: `Não foi possível consultar o Postgres: ${
          error instanceof Error ? error.message : "erro desconhecido"
        }`,
      },
      { status: 503 },
    );
  }
}
