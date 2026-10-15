import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { query, queryOne } from "@/lib/db";

export const SESSION_COOKIE = "dp_session";
const SESSION_DAYS = 30;

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
}

// Só o hash vai para o banco: quem lê uma cópia do banco não forja um cookie.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Abre uma sessão e grava o cookie. Só chamar de Server Action ou Route
 * Handler — Server Component não pode escrever cookie.
 *
 * `secure` segue o protocolo que o navegador realmente usou (o proxy do Coolify
 * termina o TLS e fala HTTP com o container, então `NODE_ENV` não serve de
 * critério): um cookie `Secure` servido por HTTP simples nunca volta, e o login
 * pareceria funcionar e deslogaria na página seguinte.
 */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await query("insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)", [
    hashToken(token),
    userId,
    expires,
  ]);

  // Aproveita para varrer as sessões vencidas: é a única limpeza que existe, e
  // a tabela é pequena.
  await query("delete from sessions where expires_at < now()");

  const headerList = await headers();
  const secure = headerList.get("x-forwarded-proto") === "https";

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await query("delete from sessions where token_hash = $1", [hashToken(token)]);
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Quem está logado, ou null. Confere o cookie contra o banco, então apagar a
 * linha em `sessions` derruba o acesso na hora.
 *
 * Memoizado com `cache()`, de escopo por requisição: cada requisição memoiza do
 * zero, então nenhuma sessão vaza de um usuário para outro.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  return queryOne<CurrentUser>(
    `select u.id, u.email, u.name
       from sessions s join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [hashToken(token)],
  );
});

/**
 * Id do usuário logado, ou manda para o login.
 *
 * É a única checagem de identidade da aplicação: toda consulta filtra por
 * `user_id`, e todo INSERT grava o id devolvido aqui.
 */
export async function requireUser(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user.id;
}
