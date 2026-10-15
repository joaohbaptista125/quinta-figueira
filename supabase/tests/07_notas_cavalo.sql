-- =============================================================================
-- Testes das notas de cavalo: quem escreve, quem lê, e o «por responder».
-- Corre depois de 01_rls.sql, que já criou as contas de acesso.
-- =============================================================================

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

-- Fidalgo e Estrela são da Sónia; Vento é do Tiago; Bolota é da escola.

\echo '== O cliente escreve sobre o cavalo dele'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000c';
set role authenticated;
do $$
begin
  insert into public.notas_cavalo (cavalo_id, texto)
  values ('33333333-0000-4000-8000-000000000001',
          'O Fidalgo veio a coxear da mão esquerda no sábado.');

  perform pg_temp.afirmar(
    (select autor_id from public.notas_cavalo
      order by criado_em desc limit 1) = public.pessoa_actual_id(),
    'a nota é assinada por quem a escreveu, e não por quem a aplicação disser');

  perform pg_temp.afirmar(
    (select not de_equipa from public.notas_cavalo
      order by criado_em desc limit 1),
    'e fica do lado do cliente');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.notas_cavalo (cavalo_id, texto)
       values ('33333333-0000-4000-8000-000000000004', 'E este?')$q$,
    'o cliente não escreve num cavalo que não é dele');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.notas_cavalo (cavalo_id, texto)
       values ('33333333-0000-4000-8000-000000000001', '   ')$q$,
    'uma nota vazia é recusada');
end $$;
reset role;

\echo '== A gestão vê que está por responder, e responde'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000a';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(
    (select por_responder from public.v_notas_por_responder
      where cavalo_id = '33333333-0000-4000-8000-000000000001'),
    'a última palavra é do cliente, logo está por responder');

  insert into public.notas_cavalo (cavalo_id, texto)
  values ('33333333-0000-4000-8000-000000000001',
          'Vimos hoje de manhã. O ferrador passa quinta-feira.');

  perform pg_temp.afirmar(
    (select de_equipa from public.notas_cavalo
      order by criado_em desc limit 1),
    'a resposta fica do lado da equipa');

  perform pg_temp.afirmar(
    (select not por_responder from public.v_notas_por_responder
      where cavalo_id = '33333333-0000-4000-8000-000000000001'),
    'e o cavalo deixa de contar para «por responder»');

  perform pg_temp.afirmar(
    (select total_notas from public.v_notas_por_responder
      where cavalo_id = '33333333-0000-4000-8000-000000000001') = 2,
    'a vista conta as notas todas, não só a última');

  perform pg_temp.afirmar(
    (select count(*) from public.v_notas_por_responder) = 1,
    'os cavalos sem conversa nenhuma não aparecem na vista');
end $$;
reset role;

\echo '== Uma conversa não se reescreve depois do facto'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000c';
set role authenticated;
do $$
begin
  update public.notas_cavalo set texto = 'Outra coisa qualquer';
  perform pg_temp.afirmar(
    (select count(*) from public.notas_cavalo
      where texto = 'Outra coisa qualquer') = 0,
    'nem o autor edita a nota que escreveu');

  delete from public.notas_cavalo;
  perform pg_temp.afirmar(
    (select count(*) from public.notas_cavalo) = 2,
    'nem a apaga');
end $$;
reset role;

\echo '== Quem não é dono não lê'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000d';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(
    (select count(*) from public.notas_cavalo) = 0,
    'o outro cliente não vê a conversa do cavalo da Sónia');

  perform pg_temp.afirmar(
    (select count(*) from public.v_notas_por_responder) = 0,
    'e a vista obedece à mesma regra');
end $$;
reset role;

\echo '== O tratador lê e responde, a gestão é que apaga'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000b';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(
    (select count(*) from public.notas_cavalo) = 2,
    'quem é da equipa vê as conversas de todos os cavalos');

  insert into public.notas_cavalo (cavalo_id, texto)
  values ('33333333-0000-4000-8000-000000000001', 'Ficou tudo bem.');
  perform pg_temp.afirmar(true, 'e responde');

  delete from public.notas_cavalo;
  perform pg_temp.afirmar(
    (select count(*) from public.notas_cavalo) = 3,
    'mas não apaga — isso é de gestão');
end $$;
reset role;

set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000a';
set role authenticated;
do $$
begin
  delete from public.notas_cavalo;
  perform pg_temp.afirmar(
    (select count(*) from public.notas_cavalo) = 0,
    'a gestão apaga, para o caso de alguém escrever o que não devia');
end $$;
reset role;

\echo '== Testes de notas: todos passaram'
