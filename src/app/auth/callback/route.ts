import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePublicOrigin } from "@/lib/public-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fim do fluxo de confirmação de e-mail (e de qualquer link do Supabase Auth).
 *
 * O link do e-mail aponta para /auth/v1/verify no Supabase, que valida o token
 * e devolve o navegador para cá com `?code=`. Esse código ainda não é uma
 * sessão: precisa ser trocado no servidor, com o verificador PKCE que ficou no
 * cookie quando o cadastro começou. Sem esta rota, o link "funciona" — o
 * Supabase marca o e-mail como confirmado — mas a pessoa volta para o app
 * deslogada e sem entender por quê.
 *
 * O redirect final é montado a partir dos cabeçalhos do proxy, pelo mesmo
 * motivo do resto do app: `request.nextUrl` aponta para o endereço interno do
 * container, não para o domínio.
 */
export async function GET(request: NextRequest) {
  const origin = resolvePublicOrigin(
    request.headers.get("host"),
    request.headers.get("x-forwarded-host"),
    request.headers.get("x-forwarded-proto"),
    request.nextUrl.origin,
  );

  const code = request.nextUrl.searchParams.get("code");
  const nextParam = request.nextUrl.searchParams.get("next");
  // Mesmo cuidado do login: só caminho relativo, senão o parâmetro vira um
  // redirect aberto para qualquer site.
  const next = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/hoje";

  // O Supabase devolve o erro na própria URL quando o link expirou ou já foi
  // usado. Repassar isso para o login é mais útil que uma tela genérica.
  const errorDescription =
    request.nextUrl.searchParams.get("error_description") ??
    request.nextUrl.searchParams.get("error");

  if (errorDescription) {
    const url = new URL("/login", origin);
    url.searchParams.set("erro", errorDescription);
    return NextResponse.redirect(url);
  }

  if (!code) {
    const url = new URL("/login", origin);
    url.searchParams.set("erro", "Link inválido ou incompleto.");
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const url = new URL("/login", origin);
    url.searchParams.set("erro", error.message);
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(next, origin));
}
