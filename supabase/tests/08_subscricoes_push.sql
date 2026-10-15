-- =============================================================================
-- Testes das subscrições de notificação: a tabela mais fechada da aplicação.
-- Corre depois de 01_rls.sql, que já criou as contas de acesso.
-- =============================================================================
-- Com `endpoint`, `p256dh` e `auth` manda-se uma notificação para o telemóvel
-- de alguém. Por isso aqui não há excepção para a gestão: ninguém lê a morada
-- do telemóvel de outra pessoa a partir de uma sessão.

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

\echo '== Cada um subscreve o seu telemóvel'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000c';
set role authenticated;
do $$
begin
  insert into public.subscricoes_push (pessoa_id, endpoint, p256dh, auth, agente)
  values (public.pessoa_actual_id(), 'https://exemplo.push/sonia', 'chave-p', 'chave-a', 'iPhone');

  perform pg_temp.afirmar(
    (select count(*) from public.subscricoes_push) = 1,
    'o cliente subscreve e vê a sua subscrição');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.subscricoes_push (pessoa_id, endpoint, p256dh, auth)
       values ('22222222-0000-4000-8000-000000000004',
               'https://exemplo.push/tiago-falso', 'x', 'y')$q$,
    'ninguém subscreve em nome de outra pessoa');

  -- O mesmo browser a autorizar outra vez devolve a mesma morada.
  perform pg_temp.afirmar_recusa(
    $q$insert into public.subscricoes_push (pessoa_id, endpoint, p256dh, auth)
       values (public.pessoa_actual_id(), 'https://exemplo.push/sonia', 'outra', 'outra')$q$,
    'a mesma morada não entra duas vezes');
end $$;
reset role;

\echo '== Nem a gestão lê a morada do telemóvel de outra pessoa'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000a';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(
    (select count(*) from public.subscricoes_push) = 0,
    'o admin NÃO vê as subscrições dos outros');

  delete from public.subscricoes_push;
  perform pg_temp.afirmar(
    (select count(*) from public.subscricoes_push) = 0,
    'nem as apaga — não encontra linha nenhuma para apagar');
end $$;
reset role;

\echo '== E continuam lá, intactas'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000c';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(
    (select count(*) from public.subscricoes_push) = 1,
    'a tentativa da gestão não levou a subscrição do cliente');

  delete from public.subscricoes_push;
  perform pg_temp.afirmar(
    (select count(*) from public.subscricoes_push) = 0,
    'mas o dono apaga a sua quando quiser');
end $$;
reset role;

\echo '== Apagar a pessoa leva as subscrições consigo'
set role postgres;
do $$
declare v_pessoa uuid;
begin
  insert into public.pessoas (nome) values ('Passageira') returning id into v_pessoa;
  insert into public.subscricoes_push (pessoa_id, endpoint, p256dh, auth)
  values (v_pessoa, 'https://exemplo.push/passageira', 'x', 'y');

  delete from public.pessoas where id = v_pessoa;
  perform pg_temp.afirmar(
    (select count(*) from public.subscricoes_push where pessoa_id = v_pessoa) = 0,
    'a subscrição não sobrevive à ficha (cascade)');
end $$;
reset role;

\echo '== Testes de subscrições: todos passaram'
