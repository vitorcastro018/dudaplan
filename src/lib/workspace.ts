import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { ApiError } from "@/lib/http";

export interface CurrentContext {
  userId: string;
  workspaceId: string;
}

/**
 * Usuário logado + workspace ativo.
 *
 * O RLS já filtra toda leitura sozinho, mas **todo INSERT precisa do
 * workspace_id explícito**: a política `with check` exige que ele seja um
 * workspace do usuário, e uma linha sem ele é recusada pelo banco.
 *
 * `cache()` para não repetir a consulta a cada componente do mesmo render.
 */
export const getContext = cache(async (): Promise<CurrentContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("workspace_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new ApiError(500, "workspace_lookup_failed", error.message);
  if (!data) return null;

  return { userId: user.id, workspaceId: data.workspace_id };
});

/**
 * Idem, para páginas: manda para o login em vez de devolver null.
 *
 * Um usuário autenticado mas sem associação não é caso normal — o trigger
 * `on_auth_user_created` cria workspace e associação no cadastro. Se acontecer,
 * é sinal de que o trigger não estava instalado quando a conta foi criada, e
 * calar isso deixaria o app abrindo vazio sem explicação.
 */
export async function requireContext(): Promise<CurrentContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const context = await getContext();
  if (!context) {
    throw new Error(
      `A conta ${user.email} não tem workspace associado. Isso acontece quando ela foi ` +
        `criada antes do trigger on_auth_user_created existir — rode a migration ` +
        `20260728000003_auth_bootstrap.sql e recrie o usuário.`,
    );
  }

  return context;
}
