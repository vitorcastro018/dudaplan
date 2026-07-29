import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|mark.svg|login|api/health).*)"],
};

/**
 * Origem pública do app, vista pelo navegador.
 *
 * Atrás do proxy do Coolify o container é alcançado em 0.0.0.0:6555, e o
 * domínio existe só nos cabeçalhos. `request.nextUrl` e `request.url` refletem
 * o endereço de bind, não o domínio — verificado enviando Host e
 * X-Forwarded-Host do domínio público: o redirect saía para
 * http://127.0.0.1:6555/login de qualquer jeito, e o navegador batia num
 * endereço interno que não existe para ele.
 *
 * Location relativo resolveria isso sozinho, mas a camada de proxy do Next
 * parseia o cabeçalho como URL absoluta e responde 500 (ERR_INVALID_URL).
 * Então a origem é remontada aqui.
 *
 * Sobre confiar nesses cabeçalhos: quem fala direto com o container pode
 * forjá-los, e o pior caso é redirecionar a si mesmo para outro host. Quando
 * APP_ALLOWED_ORIGINS está definida, o host precisa estar nela; sem ela,
 * aceita-se o que o proxy mandou, que é o comportamento necessário para
 * funcionar sem configuração extra.
 */
function publicOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return request.nextUrl.origin;

  const allowed = (process.env.APP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (allowed.length > 0 && !allowed.includes(host)) {
    return request.nextUrl.origin;
  }

  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Roda sempre, inclusive para quem já está logado: é aqui que o token
  // renovado volta para o cookie. Sair cedo quando a sessão parece válida
  // deixaria o refresh nunca ser gravado, e a sessão morreria sozinha.
  const { response, user } = await updateSession(request);

  if (user) return response;

  if (pathname.startsWith("/api")) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sessão inválida ou expirada." } },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/login", publicOrigin(request));
  loginUrl.searchParams.set("next", pathname);

  const redirect = NextResponse.redirect(loginUrl);

  // Preserva os cookies de sessão renovados por updateSession: sem isto, um
  // token que acabou de ser atualizado se perderia no redirect.
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }

  return redirect;
}
