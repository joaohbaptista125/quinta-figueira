-- =============================================================================
-- Testes dos encargos avulsos: quem vê, quem cobra, e o estado derivado.
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

-- A Sónia é dona do Fidalgo e da Estrela; o Tiago é dono do Vento.
\set sonia '''22222222-0000-4000-8000-000000000003'''
\set tiago '''22222222-0000-4000-8000-000000000004'''
\set fidalgo '''33333333-0000-4000-8000-000000000001'''

\echo '== O estado de um encargo é derivado, como o das mensalidades'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000a';
set role authenticated;
do $$
declare
  v_encargo uuid;
  v_metade  uuid;
begin
  insert into public.encargos (pessoa_id, cavalo_id, descricao, valor)
  values ('22222222-0000-4000-8000-000000000003',
          '33333333-0000-4000-8000-000000000001',
          'Ferração completa', 60.00)
  returning id into v_encargo;

  perform pg_temp.afirmar(
    (select estado from public.encargos where id = v_encargo) = 'pendente',
    'um encargo nasce pendente');

  -- Metade: continua pendente, como uma mensalidade paga a meio.
  insert into public.recebimentos
    (data, pessoa_id, valor, metodo_pagamento, conta_id, tipo, encargo_id)
  values (current_date, '22222222-0000-4000-8000-000000000003', 30.00,
          'dinheiro', '11111111-0000-4000-8000-000000000001', 'outro', v_encargo)
  returning id into v_metade;

  perform pg_temp.afirmar(
    (select estado from public.encargos where id = v_encargo) = 'pendente',
    'pagar metade mantém o encargo pendente');

  perform pg_temp.afirmar(
    (select valor_em_falta from public.v_encargos_por_receber
      where encargo_id = v_encargo) = 30.00,
    'a vista diz quanto falta');

  insert into public.recebimentos
    (data, pessoa_id, valor, metodo_pagamento, conta_id, tipo, encargo_id)
  values (current_date, '22222222-0000-4000-8000-000000000003', 30.00,
          'mbway', '11111111-0000-4000-8000-000000000001', 'outro', v_encargo);

  perform pg_temp.afirmar(
    (select estado from public.encargos where id = v_encargo) = 'pago',
    'completar o valor dá o encargo por pago');

  delete from public.recebimentos where id = v_metade;

  perform pg_temp.afirmar(
    (select estado from public.encargos where id = v_encargo) = 'pendente',
    'apagar um pagamento devolve o encargo a pendente');

  -- Anulado é decisão de gestão e não se desfaz sozinha.
  update public.encargos set estado = 'anulado' where id = v_encargo;
  insert into public.recebimentos
    (data, pessoa_id, valor, metodo_pagamento, conta_id, tipo, encargo_id)
  values (current_date, '22222222-0000-4000-8000-000000000003', 60.00,
          'dinheiro', '11111111-0000-4000-8000-000000000001', 'outro', v_encargo);

  perform pg_temp.afirmar(
    (select estado from public.encargos where id = v_encargo) = 'anulado',
    'um encargo anulado não volta sozinho a pago');

  delete from public.recebimentos where encargo_id = v_encargo;
  delete from public.encargos where id = v_encargo;
end $$;

\echo '== As regras da própria tabela'
do $$
declare
  v_encargo     uuid;
  v_mensalidade uuid;
  v_ferracao    uuid;
begin
  insert into public.encargos (pessoa_id, descricao, valor)
  values ('22222222-0000-4000-8000-000000000003', 'Transporte a concurso', 80.00)
  returning id into v_encargo;

  select id into v_mensalidade from public.mensalidades_penso limit 1;

  perform pg_temp.afirmar_recusa(
    format($q$insert into public.recebimentos
               (data, pessoa_id, valor, metodo_pagamento, conta_id, tipo,
                mensalidade_id, encargo_id)
             values (current_date, '22222222-0000-4000-8000-000000000003', 10.00,
                     'dinheiro', '11111111-0000-4000-8000-000000000001', 'penso',
                     %L, %L)$q$, v_mensalidade, v_encargo),
    'um recebimento não paga uma mensalidade e um encargo ao mesmo tempo');

  insert into public.ferracoes (cavalo_id, data)
  values ('33333333-0000-4000-8000-000000000001', current_date - 3)
  returning id into v_ferracao;

  insert into public.encargos (pessoa_id, ferracao_id, descricao, valor)
  values ('22222222-0000-4000-8000-000000000003', v_ferracao, 'Ferração', 55.00);

  perform pg_temp.afirmar_recusa(
    format($q$insert into public.encargos (pessoa_id, ferracao_id, descricao, valor)
             values ('22222222-0000-4000-8000-000000000003', %L, 'Ferração outra vez', 55.00)$q$,
           v_ferracao),
    'a mesma ferração não se cobra duas vezes');

  delete from public.encargos where ferracao_id = v_ferracao;
  delete from public.ferracoes where id = v_ferracao;
  delete from public.encargos where id = v_encargo;
end $$;
reset role;

\echo '== Quem vê um encargo'
do $$
declare v_sonia uuid; v_tiago uuid;
begin
  set local role postgres;
  insert into public.encargos (pessoa_id, descricao, valor)
  values ('22222222-0000-4000-8000-000000000003', 'Ferração da Sónia', 55.00)
  returning id into v_sonia;
  insert into public.encargos (pessoa_id, descricao, valor)
  values ('22222222-0000-4000-8000-000000000004', 'Ferração do Tiago', 55.00)
  returning id into v_tiago;
end $$;

-- --- cliente (Sónia) --------------------------------------------------------
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000c';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(
    (select count(*) from public.encargos) = 1,
    'o cliente vê o encargo dele, e só');

  perform pg_temp.afirmar(
    (select bool_and(pessoa_id = public.pessoa_actual_id()) from public.encargos),
    'e o que vê é mesmo dele');

  perform pg_temp.afirmar(
    (select count(*) from public.v_encargos_por_receber) = 1,
    'a vista obedece à mesma regra');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.encargos (pessoa_id, descricao, valor)
       values (public.pessoa_actual_id(), 'Inventado por mim', 5.00)$q$,
    'o cliente não se cobra a si próprio');

  -- Um UPDATE que a RLS não deixa ver não rebenta: não encontra linha nenhuma.
  update public.encargos set valor = 0;
  perform pg_temp.afirmar(
    (select bool_and(valor = 55.00) from public.encargos),
    'nem se perdoa a dívida');
end $$;
reset role;

-- --- instrutor: cadastro sim, dinheiro não ----------------------------------
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000b';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(
    (select count(*) from public.encargos) = 0,
    'o instrutor NÃO vê encargos — são dinheiro, como os contratos');
end $$;
reset role;

set role postgres;
delete from public.encargos;
reset role;

\echo '== Testes de encargos: todos passaram'
