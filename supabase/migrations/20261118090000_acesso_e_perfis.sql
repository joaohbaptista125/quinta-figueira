-- =============================================================================
-- Duas coisas sobre quem entra e com que perfil
-- =============================================================================
-- 1. A ficha e a conta ligam-se **nos dois sentidos**, e não só num.
-- 2. O perfil de administrador deixa de poder ser dado, tirado ou apagado por
--    quem não é administrador.
--
-- As duas apareceram juntas: a tentar perceber porque é que uma pessoa com
-- ficha de gestor continuava a ver «conta sem acesso».

-- =============================================================================
-- 1. Ligar a ficha à conta que já existe
-- =============================================================================
-- **O que estava mal.** `ligar_pessoa_ao_criar_utilizador` corre em
-- `auth.users`, e portanto só liga a ficha **no instante em que a conta
-- nasce**. Isso cobre o caminho previsto — a gestão escreve a ficha, manda o
-- convite, a pessoa carrega no link — e falha em todos os outros:
--
--   * a pessoa criou conta sozinha (ou foi convidada) **antes** de alguém lhe
--     escrever a ficha;
--   * a ficha foi escrita com o email trocado e corrigido depois.
--
-- Nesses casos a ficha ficava para sempre com `auth_user_id` a null, e a
-- aplicação dizia «a sua conta está criada mas ainda não está associada a
-- nenhuma ficha» — mesmo depois de a ficha existir, e mesmo com perfil de
-- gestor. Não havia maneira de sair dali sem ir ao painel do Supabase.
--
-- A trigger que falta é a simétrica: quando uma ficha é escrita (ou lhe
-- corrigem o email), procura-se uma conta com esse endereço.

create or replace function public.ligar_ficha_a_conta_existente()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_conta uuid;
begin
  if new.auth_user_id is not null
     or new.email is null
     or btrim(new.email) = '' then
    return new;
  end if;

  -- `btrim` além do `lower`: um espaço à direita no email da ficha é
  -- invisível no ecrã e chegava para a ligação nunca acontecer.
  --
  -- A conta só serve se não estiver já presa a outra ficha — `auth_user_id`
  -- é único, e sem esta condição a gravação rebentava com um 23505 em vez de
  -- simplesmente não ligar.
  select u.id into v_conta
    from auth.users u
   where lower(btrim(u.email)) = lower(btrim(new.email))
     and not exists (
       select 1 from public.pessoas p where p.auth_user_id = u.id
     )
   limit 1;

  if v_conta is not null then
    new.auth_user_id := v_conta;
    new.perfil := coalesce(new.perfil, 'cliente');
  end if;

  return new;
end;
$$;

create trigger pessoas_ligar_conta
  before insert or update of email, auth_user_id on public.pessoas
  for each row execute function public.ligar_ficha_a_conta_existente();

-- O mesmo `btrim` do outro lado, pelo mesmo motivo.
create or replace function public.ligar_pessoa_a_novo_utilizador()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is null then
    return new;
  end if;

  update public.pessoas
     set auth_user_id   = new.id,
         perfil         = coalesce(perfil, 'cliente'),
         actualizado_em = now()
   where auth_user_id is null
     and email is not null
     and lower(btrim(email)) = lower(btrim(new.email));

  return new;
end;
$$;

-- As que já ficaram penduradas. É isto que desbloqueia quem está à espera
-- neste momento.
update public.pessoas p
   set auth_user_id = u.id,
       perfil       = coalesce(p.perfil, 'cliente')
  from auth.users u
 where p.auth_user_id is null
   and p.email is not null
   and lower(btrim(p.email)) = lower(btrim(u.email))
   and not exists (
     select 1 from public.pessoas outra where outra.auth_user_id = u.id
   );

-- =============================================================================
-- 2. O perfil de administrador
-- =============================================================================
-- **O que estava mal.** `pessoas_gerir` é `e_gestao()` e vale `for all`, por
-- isso um **gestor podia escrever qualquer coluna de qualquer ficha** — o
-- `perfil` incluído. Na prática:
--
--   * um gestor punha-se a si próprio a `admin`;
--   * um gestor punha o admin a `cliente`, ou desactivava-o.
--
-- O segundo é o que faz mais estrago, e não é óbvio: `reclamar_primeiro_admin()`
-- existe para o arranque e só se recusa **enquanto houver um admin activo**.
-- Sem nenhum, passa a poder ser chamada por qualquer utilizador autenticado —
-- ou seja, tirar o último admin não deixa o centro sem dono, deixa-o à mercê
-- de quem lá chegar primeiro.
--
-- **A RLS decide linhas, não colunas**, e o que era preciso travar era uma
-- coluna. Como em `carimbar_cavalo_proposto` e nas outras, quem o faz é uma
-- trigger.
--
-- O que **não** muda: um gestor continua a dar e a tirar os outros perfis
-- (cliente, instrutor, tratador). O que passa a ser só do administrador é o
-- próprio perfil de administrador.

create or replace function public.travar_perfil_de_administrador()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_antigo text := coalesce(old.perfil::text, '');
  v_novo   text := coalesce(new.perfil::text, '');
begin
  -- Arranque: sem nenhum admin activo quem manda é `reclamar_primeiro_admin()`,
  -- que tem as suas próprias guardas. Travar aqui impedia o primeiro acesso.
  if not exists (
    select 1 from public.pessoas where perfil = 'admin' and activo
  ) then
    return coalesce(new, old);
  end if;

  -- Sem sessão (seed, migrações, restauros) isto não se aplica.
  if public.pessoa_actual_id() is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if v_antigo = 'admin' and old.activo then
      raise exception 'Não se apaga a ficha de um administrador activo. Tire-lhe primeiro o perfil.'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if v_novo = 'admin' and not public.e_admin() then
      raise exception 'Só um administrador cria outro administrador.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- Dar ou tirar o perfil de administrador é só do administrador.
  if v_novo is distinct from v_antigo
     and (v_antigo = 'admin' or v_novo = 'admin')
     and not public.e_admin() then
    raise exception 'Só um administrador dá ou tira o perfil de administrador.'
      using errcode = '42501';
  end if;

  -- O último administrador activo não se tira — nem mudando-lhe o perfil, nem
  -- desactivando-o, e nem pelo próprio. Ver em cima o que isso abria.
  if v_antigo = 'admin' and old.activo
     and (v_novo <> 'admin' or not new.activo)
     and not exists (
       select 1 from public.pessoas
        where perfil = 'admin' and activo and id <> old.id
     ) then
    raise exception 'Este é o único administrador activo do centro. Promova outro antes de lhe tirar o perfil.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger pessoas_travar_perfil_admin
  before insert or update or delete on public.pessoas
  for each row execute function public.travar_perfil_de_administrador();

comment on function public.travar_perfil_de_administrador() is
  'A RLS deixa um gestor escrever a ficha toda; isto tira-lhe a coluna perfil quando ela vale admin, e protege o último administrador activo.';
