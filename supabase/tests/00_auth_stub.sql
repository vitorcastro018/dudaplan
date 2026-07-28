-- Stub do que o Supabase provê: schema auth, tabela auth.users e auth.uid().
create schema if not exists auth;
create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email citext unique,
  -- Coluna real do Supabase: metadados editáveis pelo próprio usuário.
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- No Supabase, auth.uid() lê a claim "sub" do JWT. Aqui lê um GUC de sessão
-- para eu poder trocar de identidade no teste.
create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid
$$;

-- Papéis que o Supabase cria. `authenticated` NÃO é dono das tabelas, então o
-- RLS realmente se aplica a ele (dono de tabela ignora RLS sem FORCE).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
