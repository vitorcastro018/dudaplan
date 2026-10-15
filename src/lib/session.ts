import { redirect } from "next/navigation";
import { getAuthClaims } from "@/lib/supabase/server";

/**
 * Id do usuário logado, ou manda para o login.
 *
 * É a única checagem de identidade da aplicação: quem pode ver ou mexer em quê
 * é decidido pelo RLS (`user_id = auth.uid()`), então aqui só importa saber
 * quem está logado — e o id, que todo INSERT grava em `user_id`.
 *
 * `getAuthClaims` já memoiza por requisição, então chamar isto em várias
 * actions e componentes do mesmo render não repete a verificação.
 */
export async function requireUser(): Promise<string> {
  const claims = await getAuthClaims();
  if (!claims) redirect("/login");
  return claims.userId;
}
