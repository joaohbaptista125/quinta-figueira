-- =============================================================================
-- Paddocks: quem escreve no quadro, e quem o lê
-- =============================================================================
-- Corre depois de 01_rls.sql, que já criou as contas de acesso.
--
-- O que este ficheiro prova, e porquê:
--
-- * **Quem larga é quem planeia o dia** — gestão e instrutor. Era de toda a
--   equipa, tratador incluído; o centro pediu que o tratador passasse a
--   consultar, e é a migração `…_tratador_so_consulta.sql` que o explica.
-- * **O tratador lê o quadro inteiro e não lhe toca.** Continua a precisar de
--   saber quem já saiu — é a pergunta que o quadro existe para responder.
-- * **O dono vê o cavalo dele, e só esse.** É o que torna o aviso de «está no
--   paddock» verificável do lado dele.
-- * **O dono não larga nem recolhe.** O quadro é da cavalariça.
-- * **Um cavalo num campo de cada vez, no mesmo dia.**
-- * **A ocupação de ontem não aparece no quadro de hoje** — é isso que faz o
--   ecrã limpar-se sozinho à meia-noite, sem ninguém o apagar à mão.

\set ON_ERROR_STOP on
set client_min_messages to notice;

create or replace function pg_temp.afirmar(p_condicao boolean, p_descricao text)
returns void language plpgsql as $$
begin
  if p_condicao is not true then
    raise exception 'FALHOU: %', p_descricao;
  end if;
  raise notice '  ok  %', p_descricao;
end $$;

create or replace function pg_temp.afirmar_recusa(p_sql text, p_descricao text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice '  ok  % (%)', p_descricao, sqlstate;
    return;
  end;
  raise exception 'FALHOU: % — foi aceite e devia ter sido recusado', p_descricao;
end $$;

create or replace function pg_temp.afirmar_sem_efeito(p_sql text, p_descricao text)
returns void language plpgsql as $$
declare v_linhas integer;
begin
  execute p_sql;
  get diagnostics v_linhas = row_count;
  if v_linhas <> 0 then
    raise exception 'FALHOU: % — afectou % linha(s)', p_descricao, v_linhas;
  end if;
  raise notice '  ok  % (0 linhas afectadas)', p_descricao;
end $$;

-- O Alberto é tratador e não tem email na seed, porque não usa a aplicação.
-- Aqui precisa de entrar: é ele que larga os cavalos.
set role postgres;
update public.pessoas
   set email = 'alberto@quintadafigueira.pt'
 where id = '22222222-0000-4000-8000-000000000005';
reset role;

insert into auth.users (id, email) values
  ('99999999-0000-4000-8000-00000000000e', 'alberto@quintadafigueira.pt');

do $$
begin
  perform pg_temp.afirmar(
    (select perfil from public.pessoas
      where id = '22222222-0000-4000-8000-000000000005') = 'tratador',
    'o Alberto entrou e continua tratador — a trigger não lhe mexeu no perfil');
end $$;

\echo '== Os oito campos vêm com a migração'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000c';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(
    (select count(*) from public.paddocks) = 8,
    'toda a gente autenticada vê os oito paddocks');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.paddocks (numero) values (9)$q$,
    'mas mexer na lista dos campos é da gestão');
end $$;
reset role;

\echo '== O instrutor larga os cavalos'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000b';
set role authenticated;
do $$
declare v_paddock uuid;
begin
  select id into v_paddock from public.paddocks where numero = 5;

  -- A Estrela é da Sónia e ainda não saiu hoje (a seed larga o Fidalgo e o
  -- Vento).
  insert into public.paddock_ocupacao (paddock_id, cavalo_id)
  values (v_paddock, '33333333-0000-4000-8000-000000000002');

  perform pg_temp.afirmar(
    (select count(*) from public.paddock_ocupacao
      where data = current_date) = 3,
    'quem planeia o dia escreve no quadro, e vê-o inteiro');

  -- Vários cavalos no mesmo campo: é o contrário das boxes, e foi pedido.
  insert into public.paddock_ocupacao (paddock_id, cavalo_id)
  values (v_paddock, '33333333-0000-4000-8000-000000000005');

  perform pg_temp.afirmar(
    (select count(*) from public.paddock_ocupacao
      where paddock_id = v_paddock and data = current_date) = 2,
    'cabem vários cavalos no mesmo paddock');

  perform pg_temp.afirmar_recusa(
    format($q$insert into public.paddock_ocupacao (paddock_id, cavalo_id)
              values (%L, '33333333-0000-4000-8000-000000000002')$q$,
           (select id from public.paddocks where numero = 6)),
    'o mesmo cavalo não está em dois campos no mesmo dia');
end $$;
reset role;

\echo '== O tratador lê o quadro inteiro, e não lhe toca'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000e';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(
    (select count(*) from public.paddock_ocupacao
      where data = current_date) = 4,
    'o tratador continua a ver quem já saiu — é para isso que o quadro existe');

  perform pg_temp.afirmar_recusa(
    format($q$insert into public.paddock_ocupacao (paddock_id, cavalo_id)
              values (%L, '33333333-0000-4000-8000-000000000004')$q$,
           (select id from public.paddocks where numero = 7)),
    'mas já não larga nenhum');

  perform pg_temp.afirmar_sem_efeito(
    $q$delete from public.paddock_ocupacao where data = current_date$q$,
    'nem recolhe');
end $$;
reset role;

\echo '== O dono vê o cavalo dele, e mais nenhum'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000d';
set role authenticated;
do $$
begin
  -- O Tiago é dono do Vento, e só do Vento.
  perform pg_temp.afirmar(
    (select count(*) from public.paddock_ocupacao where data = current_date) = 1,
    'o dono vê uma linha: a do cavalo dele');

  perform pg_temp.afirmar(
    (select cavalo_id from public.paddock_ocupacao where data = current_date)
      = '33333333-0000-4000-8000-000000000003',
    'e é mesmo o cavalo dele');

  perform pg_temp.afirmar_recusa(
    format($q$insert into public.paddock_ocupacao (paddock_id, cavalo_id)
              values (%L, '33333333-0000-4000-8000-000000000003')$q$,
           (select id from public.paddocks where numero = 7)),
    'o dono não larga o cavalo — isso é da cavalariça');

  perform pg_temp.afirmar_sem_efeito(
    $q$delete from public.paddock_ocupacao where data = current_date$q$,
    'nem o recolhe');
end $$;
reset role;

\echo '== O quadro de hoje não arrasta o de ontem'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000b';
set role authenticated;
do $$
declare v_paddock uuid;
begin
  select id into v_paddock from public.paddocks where numero = 2;

  -- A mesma Estrela, ontem, noutro campo: a restrição é por dia e aceita.
  insert into public.paddock_ocupacao (paddock_id, cavalo_id, data)
  values (v_paddock, '33333333-0000-4000-8000-000000000002', current_date - 1);

  perform pg_temp.afirmar(
    (select count(*) from public.paddock_ocupacao where data = current_date) = 4,
    'a largada de ontem não entra no quadro de hoje');

  delete from public.paddock_ocupacao where data = current_date - 1;
end $$;
reset role;

\echo '== Apagar um paddock leva a ocupação consigo, e não toca nos cavalos'
set role postgres;
do $$
declare v_paddock uuid;
begin
  insert into public.paddocks (numero) values (99) returning id into v_paddock;
  insert into public.paddock_ocupacao (paddock_id, cavalo_id)
  values (v_paddock, '33333333-0000-4000-8000-000000000004');

  delete from public.paddocks where id = v_paddock;

  perform pg_temp.afirmar(
    (select count(*) from public.paddock_ocupacao where paddock_id = v_paddock) = 0,
    'a ocupação morre com o campo (cascade)');

  perform pg_temp.afirmar(
    (select count(*) from public.cavalos
      where id = '33333333-0000-4000-8000-000000000004') = 1,
    'e o cavalo fica onde estava');
end $$;
reset role;

\echo '== As boxes saíram mesmo'
set role postgres;
do $$
begin
  perform pg_temp.afirmar(
    (select count(*) from pg_tables
      where schemaname = 'public' and tablename = 'boxes') = 0,
    'a tabela boxes já não existe');
end $$;
reset role;

\echo '== Testes de paddocks: todos passaram'
