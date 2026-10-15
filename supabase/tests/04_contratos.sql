-- =============================================================================
-- Porque é que apagar um contrato de penso tem travão na aplicação
-- =============================================================================
-- Este ficheiro não testa código nosso: testa o que a base de dados faz, e é
-- a razão de `apagarContrato` em `lib/accoes/cadastro-diverso.ts` recusar
-- antes de chegar ao Postgres.
--
-- `mensalidades_penso.contrato_id` é `on delete cascade` e
-- `recebimentos.mensalidade_id` é `on delete set null`. Apagar o contrato
-- leva consigo as mensalidades e **desliga os pagamentos do mês que pagaram**,
-- sem erro nenhum. O dinheiro fica, mas deixa de se saber ao que respeitava —
-- e isso não se desfaz.
--
-- Se um dia esta chave passar a `restrict`, este teste falha. Óptimo: quer
-- dizer que o travão pode sair da aplicação e passar a viver no esquema, que
-- é onde se preferia que estivesse.

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

\echo '== Apagar um contrato desliga o dinheiro do mês que pagou'
do $$
declare
  v_cavalo       uuid;
  v_contrato     uuid;
  v_mensalidade  uuid;
  v_recebimento  uuid;
begin
  -- Cavalo e contrato só para este teste. Cavalo novo porque os do seed já
  -- têm contrato, e dois contratos do mesmo cavalo não se podem sobrepor.
  insert into public.cavalos (nome, regime, proprietario_id)
  values ('Passageiro', 'penso', '22222222-0000-4000-8000-000000000004')
  returning id into v_cavalo;

  insert into public.contratos_penso
    (cavalo_id, cliente_id, valor_mensal, data_inicio)
  values
    (v_cavalo, '22222222-0000-4000-8000-000000000004', 300.00, current_date - 60)
  returning id into v_contrato;

  insert into public.mensalidades_penso (contrato_id, periodo, valor)
  values (v_contrato, date_trunc('month', current_date - 31)::date, 300.00)
  returning id into v_mensalidade;

  insert into public.recebimentos
    (data, pessoa_id, valor, metodo_pagamento, conta_id, tipo, mensalidade_id)
  values
    (current_date - 20, '22222222-0000-4000-8000-000000000004', 300.00,
     'transferencia', '11111111-0000-4000-8000-000000000002', 'penso',
     v_mensalidade)
  returning id into v_recebimento;

  perform pg_temp.afirmar(
    (select estado from public.mensalidades_penso where id = v_mensalidade) = 'paga',
    'o pagamento marca a mensalidade como paga');

  delete from public.contratos_penso where id = v_contrato;

  perform pg_temp.afirmar(
    (select count(*) from public.mensalidades_penso where id = v_mensalidade) = 0,
    'apagar o contrato leva as mensalidades consigo (cascade)');

  perform pg_temp.afirmar(
    (select count(*) from public.recebimentos where id = v_recebimento) = 1,
    'o pagamento sobrevive ao contrato');

  perform pg_temp.afirmar(
    (select mensalidade_id is null from public.recebimentos where id = v_recebimento),
    'mas fica sem saber que mês pagou — é por isto que a aplicação recusa');

  delete from public.recebimentos where id = v_recebimento;
  delete from public.cavalos where id = v_cavalo;
end $$;

\echo '== Terminar um contrato não mexe no que já foi cobrado'
-- Como gestão: `gerar_mensalidades` exige `e_gestao()`.
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000a';
set role authenticated;
do $$
declare
  v_contrato uuid := '44444444-0000-4000-8000-000000000001';
  v_antes    integer;
begin
  select count(*) into v_antes
    from public.mensalidades_penso where contrato_id = v_contrato;

  update public.contratos_penso
     set data_fim = current_date
   where id = v_contrato;

  perform pg_temp.afirmar(
    (select count(*) from public.mensalidades_penso where contrato_id = v_contrato)
      = v_antes,
    'terminar um contrato deixa as mensalidades já geradas onde estão');

  -- `gerar_mensalidades` é idempotente e só olha para contratos em vigor.
  perform public.gerar_mensalidades(date_trunc('month', current_date)::date);

  perform pg_temp.afirmar(
    (select count(*) from public.mensalidades_penso where contrato_id = v_contrato)
      = v_antes,
    'e um contrato terminado deixa de gerar mensalidades novas');

  update public.contratos_penso set data_fim = null where id = v_contrato;
end $$;
reset role;

\echo '== Testes de contratos: todos passaram'
