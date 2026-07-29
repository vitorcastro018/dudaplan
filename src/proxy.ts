import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { resolvePublicOrigin } from "@/lib/public-url";

export const config = {
  // `auth/callback` fica de fora: é justamente onde a sessão passa a existir.
  // Protegê-la mandaria de volta para /login quem chegou pelo link do e-mail,
  // antes de o código virar sessão — um laço fechado.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|mark.svg|login|auth/callback|api/health).*)",
  ],
};

// Location relativo resolveria o problema do domínio sozinho, mas a camada de
// proxy do Next parseia o cabeçalho como URL absoluta e responde 500
// (ERR_INVALID_URL). Por isso a origem é remontada dos cabeçalhos.
function publicOrigin(request: NextRequest): string {
  return resolvePublicOrigin(
    request.headers.get("host"),
    request.headers.get("x-forwarded-host"),
    request.headers.get("x-forwarded-proto"),
    request.nextUrl.origin,
  );
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
