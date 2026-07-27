import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|mark.svg|login|api/auth/login|api/health).*)",
  ],
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (session) return NextResponse.next();

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
