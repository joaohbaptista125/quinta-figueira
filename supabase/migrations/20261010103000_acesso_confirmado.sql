-- =============================================================================
-- Saber quem entrou mesmo, e não só quem tem linha em auth.users
-- =============================================================================
-- `pessoas.auth_user_id` dizia «tem conta», e isso estava errado como sinal.
-- O convite é enviado com `signInWithOtp(shouldCreateUser)`, e o Supabase cria
-- a linha em `auth.users` **no momento do envio** — não quando a pessoa carrega
-- no link. A trigger `ligar_pessoa_ao_criar_utilizador` dispara logo aí e
-- preenche `auth_user_id`.
--
-- Resultado: assim que o primeiro convite saía, a ficha passava a dizer «tem
-- conta» e deixava de ser possível reenviar o convite — a alguém que ainda não
-- tinha entrado uma única vez.
--
-- Esta coluna é o sinal verdadeiro: só fica preenchida quando há um início de
-- sessão real.

alter table public.pessoas
  add column acesso_confirmado_em timestamptz;

comment on column public.pessoas.acesso_confirmado_em is
  'Primeira vez que a pessoa entrou de facto. auth_user_id só diz que a conta foi criada, o que acontece logo no envio do convite.';

create or replace function public.marcar_acesso_confirmado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.last_sign_in_at is not null then
    -- A condição `is null` faz disto um não-evento depois da primeira vez:
    -- auth.users é actualizado a cada renovação de sessão.
    update public.pessoas
       set acesso_confirmado_em = new.last_sign_in_at,
           actualizado_em       = now()
     where auth_user_id = new.id
       and acesso_confirmado_em is null;
  end if;

  return new;
end;
$$;

create trigger marcar_acesso_ao_entrar
  after update on auth.users
  for each row execute function public.marcar_acesso_confirmado();

-- Quem já entrou antes desta coluna existir não fica para trás.
update public.pessoas p
   set acesso_confirmado_em = u.last_sign_in_at
  from auth.users u
 where u.id = p.auth_user_id
   and u.last_sign_in_at is not null
   and p.acesso_confirmado_em is null;
