-- =============================================================================
-- Arremedo mínimo da plataforma Supabase, para validar as migrações contra um
-- PostgreSQL simples (CI, ou uma máquina sem Docker).
--
-- NÃO é uma migração. Nunca corre em produção — o Supabase já fornece tudo
-- isto. Ver scripts/validar-esquema.sh.
-- =============================================================================

create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;

-- Papéis que o Supabase cria por si.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;

-- auth.users e auth.uid()
create table if not exists auth.users (
  id         uuid primary key default gen_random_uuid(),
  email      text unique,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;

-- storage.buckets / storage.objects
create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text,
  owner      uuid,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to authenticated, service_role;

-- O Supabase mantém 'extensions' no search_path da base de dados.
alter database postgres set search_path to "$user", public, extensions;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
