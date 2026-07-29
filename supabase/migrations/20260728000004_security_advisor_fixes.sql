-- Correções apontadas pelos advisors de segurança do Supabase depois que o
-- schema foi aplicado no projeto de verdade.

-- 1. handle_new_auth_user estava exposta como endpoint RPC.
--
-- O comentário da migration 20260728000003 afirmava que ela "não expõe endpoint
-- nenhum (é trigger, não função chamável)". Isso estava **errado**, e o advisor
-- provou: o Postgres concede EXECUTE a PUBLIC por padrão, e o PostgREST publica
-- toda função do schema exposto — então ela era alcançável em
-- /rest/v1/rpc/handle_new_auth_user, sem login, rodando como SECURITY DEFINER.
-- Chamá-la fora de um trigger falharia, mas depender disso é apoiar a segurança
-- num detalhe de implementação.
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

-- 2. search_path fixo nas funções de trigger.
--
-- São SECURITY INVOKER, então o risco é menor que nas DEFINER, mas com
-- search_path mutável quem controla a sessão pode plantar um schema na frente
-- de `public` e trocar a tabela que a função enxerga.
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.enforce_subtask_depth() set search_path = public, pg_temp;
alter function public.enforce_ai_suggestion_transition() set search_path = public, pg_temp;
alter function public.enforce_meeting_ready() set search_path = public, pg_temp;

-- 3. citext sai de `public`.
--
-- Extensão em schema exposto permite que um objeto de mesmo nome criado depois
-- sombreie as funções dela. O tipo continua funcionando em users.email: a coluna
-- guarda o OID do tipo, que não muda ao mover o schema. Verificado depois de
-- aplicar — users.email continua citext.
alter extension citext set schema extensions;

-- Fica um aviso em aberto, de propósito: current_user_workspace_ids() mantém
-- EXECUTE para `authenticated`. É necessário — as políticas de RLS rodam no
-- contexto de quem chama, então sem o grant toda consulta falharia. E é seguro:
-- a função não recebe argumentos e filtra por auth.uid(), então devolve apenas
-- os workspaces do próprio chamador. Chamá-la direto pela API não revela nada
-- que o usuário já não pudesse ler.
