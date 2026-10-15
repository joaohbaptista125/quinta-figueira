-- =============================================================================
-- Porque é que apagar um cavalo tem travão na aplicação
-- =============================================================================
-- Como o 04, este ficheiro testa o que a base de dados faz, e é a razão de
-- `apagarCavalo` em `lib/accoes/cavalos.ts` verificar **antes** de apagar.
--
-- Só `contratos_penso.cavalo_id` é `restrict`. Os outros três caminhos são
-- perda silenciosa: as despesas e as participações em eventos ficam a apontar
-- para ninguém (`set null`) e as ferrações morrem com o cavalo (`cascade`).
-- Nada disto dá erro, e o que se perde só dá por si meses depois.
--
-- A box é o único caso em que ficar a `null` é o comportamento desejado: o
-- cavalo saiu, a box fica livre.

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

\echo '== Apagar um cavalo leva coisas consigo sem dizer nada'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000a';
set role authenticated;
do $$
declare
  v_cavalo   uuid;
  v_box      uuid;
  v_despesa  uuid;
  v_evento   uuid;
  v_parte    uuid;
begin
  insert into public.cavalos (nome, regime) values ('Fugaz', 'centro')
  returning id into v_cavalo;

  insert into public.boxes (identificacao, cavalo_id) values ('Z-99', v_cavalo)
  returning id into v_box;

  insert into public.despesas
    (data, categoria_id, descricao, valor_total, metodo_pagamento, conta_id, cavalo_id)
  values
    (current_date, (select id from public.categorias_despesa where slug = 'racao'),
     'Ferração do Fugaz', 55.00, 'dinheiro',
     '11111111-0000-4000-8000-000000000001', v_cavalo)
  returning id into v_despesa;

  insert into public.eventos (tipo, data, hora_inicio, hora_fim)
  values ('aula', current_date + 2, '10:00', '11:00')
  returning id into v_evento;

  insert into public.evento_participantes (evento_id, pessoa_id, cavalo_id)
  values (v_evento, '22222222-0000-4000-8000-000000000003', v_cavalo)
  returning id into v_parte;

  insert into public.ferracoes (cavalo_id, data) values (v_cavalo, current_date - 5);

  delete from public.cavalos where id = v_cavalo;

  perform pg_temp.afirmar(
    (select cavalo_id is null from public.boxes where id = v_box),
    'a box fica livre — o único destes que é o que se quer');

  perform pg_temp.afirmar(
    (select cavalo_id is null from public.despesas where id = v_despesa),
    'a despesa fica sem saber de que cavalo era');

  perform pg_temp.afirmar(
    (select cavalo_id is null from public.evento_participantes where id = v_parte),
    'a aula perde o par aluno-cavalo');

  perform pg_temp.afirmar(
    (select count(*) from public.ferracoes where cavalo_id = v_cavalo) = 0,
    'o histórico de ferração morre com o cavalo — e é por isto que a aplicação recusa');

  delete from public.evento_participantes where id = v_parte;
  delete from public.eventos where id = v_evento;
  delete from public.despesas where id = v_despesa;
  delete from public.boxes where id = v_box;
end $$;
reset role;

\echo '== O contrato é o único que o Postgres trava sozinho'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000a';
set role authenticated;
do $$
declare v_falhou boolean := false;
begin
  begin
    delete from public.cavalos where id = '33333333-0000-4000-8000-000000000001';
  exception when foreign_key_violation then
    v_falhou := true;
  end;

  perform pg_temp.afirmar(v_falhou,
    'um cavalo com contrato de penso não se apaga, e disso a base trata');
end $$;
reset role;

\echo '== Testes de cavalos: todos passaram'
