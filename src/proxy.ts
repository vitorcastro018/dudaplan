import { NextResponse, type NextRequest } from "next/server";
import { resolvePublicOrigin } from "@/lib/public-url";

export const config = {
  // `api/meetings` fica de fora porque é por onde sobe o áudio das reuniões.
  // Quando o proxy roda, o Next clona e bufferiza o corpo da requisição em
  // memória, com teto padrão de 10 MB, e acima disso **trunca em silêncio** —
  // a requisição não falha, só chega pela metade, e um m4a de 30 MB viraria um
  // arquivo corrompido sem uma linha de erro. Subir
  // `experimental.proxyClientMaxBodySize` até `MAX_UPLOAD_MB` resolveria o
  // truncamento à custa de segurar 200 MB na memória, o que também anularia a
  // gravação em streaming de `saveMeetingAudio`. A rota faz a própria checagem
  // de sessão.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|mark.svg|login|api/health|api/meetings).*)"],
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

/**
 * Porteiro barato: só olha se existe cookie de sessão. A conferência de
 * verdade (o cookie vale? a sessão não venceu?) acontece no banco, em
 * `requireUser` — no layout e em cada Server Action. Aqui o objetivo é só não
 * renderizar a página para quem claramente não tem sessão.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has("dp_session")) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sessão inválida ou expirada." } },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/login", publicOrigin(request));
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}
