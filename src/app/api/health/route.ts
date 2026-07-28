import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Healthcheck do container.
 *
 * Consulta uma tabela real em vez de só responder 200: sem isso, o container
 * ficaria "saudável" para o Coolify mesmo com a URL do Supabase errada ou o
 * projeto pausado, e a falha só apareceria quando você abrisse o app.
 *
 * A consulta roda sem sessão, então o RLS devolve zero linhas — é o esperado.
 * O que se testa aqui é a rede e a autenticação da chave: chave inválida ou
 * projeto fora do ar devolvem erro, e é isso que faz o healthcheck falhar.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("workspaces").select("id").limit(1);

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 503 });
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "unknown" },
      { status: 503 },
    );
  }
}
