-- Bootstrap de cadastro.
--
-- `public.users.id` referencia `auth.users(id)`, mas nada preenche a linha do
-- lado public — o cadastro acontece dentro do Supabase Auth, que não conhece o
-- nosso schema. Sem este trigger o usuário se cadastra, recebe um JWT válido e
-- cai num app onde `auth.uid()` não casa com nenhuma linha: sem perfil, sem
-- workspace, sem associação. Tudo que o RLS protege fica invisível para ele.
--
-- Aqui é um dos poucos lugares onde SECURITY DEFINER é a escolha certa, e não
-- um atalho para calar um erro de permissão: o trigger roda durante o INSERT em
-- `auth.users`, antes de existir qualquer associação, então por definição
-- nenhuma política de RLS pode autorizá-lo. Ele não recebe entrada do usuário
-- além do próprio NEW e não expõe endpoint nenhum (é trigger, não função
-- chamável), e o `search_path` fixo impede que um schema plantado na frente de
-- `public` sequestre a execução privilegiada.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_workspace_id uuid;
  display_name text;
begin
  -- `raw_user_meta_data` é editável pelo próprio usuário, então só serve para
  -- coisa cosmética como nome de exibição. Nunca para decisão de autorização.
  display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    display_name,
    nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), '')
  )
  on conflict (id) do nothing;

  insert into public.workspaces (name, owner_id)
  values (display_name || ' — DudaPlan', new.id)
  returning id into new_workspace_id;

  insert into public.memberships (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
