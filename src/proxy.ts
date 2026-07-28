import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|mark.svg|login|api/health).*)"],
};

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

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}
