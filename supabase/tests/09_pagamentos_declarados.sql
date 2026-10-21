-- =============================================================================
-- «Já paguei»: o que o cliente pode dizer, e o que só a gestão pode fazer.
-- Corre depois de 01_rls.sql, que já criou as contas de acesso.
-- =============================================================================
-- O que estes testes guardam é uma frase: **uma declaração não é dinheiro.**
-- Se algum dia alguém ligar isto ao estado das mensalidades para «poupar um
-- clique», é aqui que rebenta.

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

-- A Maria é admin; o Rui é da equipa sem acesso ao financeiro; a Sónia e o
-- Tiago são clientes.
\set maria '''99999999-0000-4000-8000-00000000000a'''
\set rui   '''99999999-0000-4000-8000-00000000000b'''
\set sonia_user '''99999999-0000-4000-8000-00000000000c'''
\set tiago_user '''99999999-0000-4000-8000-00000000000d'''
\set sonia '''22222222-0000-4000-8000-000000000003'''
\set tiago '''22222222-0000-4000-8000-000000000004'''
\set caixa '''11111111-0000-4000-8000-000000000001'''

-- --- Terreno: três mensalidades da Sónia, num cavalo só dela ----------------
-- Cavalo novo de propósito: os do seed já têm contratos, e a restrição de
-- exclusão não deixa dois a cruzarem-se.
set request.jwt.claim.sub = :maria;
set role authenticated;
do $$
declare
  v_cavalo uuid;
  v_contrato uuid;
begin
  insert into public.cavalos (nome, sexo, proprietario_id, regime)
  values ('Declarante', 'castrado', '22222222-0000-4000-8000-000000000003', 'penso')
  returning id into v_cavalo;

  insert into public.contratos_penso
    (cavalo_id, cliente_id, valor_mensal, data_inicio)
  values (v_cavalo, '22222222-0000-4000-8000-000000000003', 100.00,
          date_trunc('month', current_date)::date - interval '3 months')
  returning id into v_contrato;

  insert into public.mensalidades_penso (contrato_id, periodo, valor) values
    (v_contrato, date_trunc('month', current_date)::date, 100.00),
    (v_contrato, (date_trunc('month', current_date) - interval '1 month')::date, 100.00),
    (v_contrato, (date_trunc('month', current_date) - interval '2 months')::date, 100.00);

  create temporary table t_mensalidades as
    select id, periodo from public.mensalidades_penso where contrato_id = v_contrato
     order by periodo desc;
end $$;
reset role;

\echo '== Declarar é do próprio, e não mexe em estado nenhum'
set request.jwt.claim.sub = :sonia_user;
set role authenticated;
do $$
declare
  v_mensalidade uuid := (select id from t_mensalidades order by periodo desc limit 1);
  v_declaracao  uuid;
begin
  -- De propósito com veneno lá dentro: em nome do Tiago, já confirmada, e com
  -- um recebimento inventado. A trigger tem de limpar tudo isto.
  insert into public.pagamentos_declarados
    (pessoa_id, mensalidade_id, valor, data, metodo_pagamento, referencia, estado)
  values ('22222222-0000-4000-8000-000000000004', v_mensalidade, 100.00,
          current_date, 'mbway', 'MB WAY 912345678', 'confirmada')
  returning id into v_declaracao;

  perform pg_temp.afirmar(
    (select pessoa_id from public.pagamentos_declarados where id = v_declaracao)
      = '22222222-0000-4000-8000-000000000003',
    'pessoa_id é carimbado: a declaração fica em nome de quem a fez');

  perform pg_temp.afirmar(
    (select estado from public.pagamentos_declarados where id = v_declaracao) = 'pendente',
    'nasce pendente, mesmo tendo sido enviada como confirmada');

  perform pg_temp.afirmar(
    (select recebimento_id is null and decidido_por is null and decidido_em is null
       from public.pagamentos_declarados where id = v_declaracao),
    'nasce sem recebimento e sem decisão');

  -- O coração disto tudo.
  perform pg_temp.afirmar(
    (select estado from public.mensalidades_penso where id = v_mensalidade) = 'pendente',
    'declarar NÃO muda o estado da mensalidade');

  perform pg_temp.afirmar(
    (select valor_em_falta from public.v_pensos_por_receber
      where mensalidade_id = v_mensalidade) = 100.00,
    'declarar NÃO desconta nada ao que falta');

  perform pg_temp.afirmar(
    (select count(*) from public.recebimentos where mensalidade_id = v_mensalidade) = 0,
    'declarar NÃO cria recebimento nenhum');

  create temporary table t_declaracao as select v_declaracao as id;
end $$;

\echo '== Duas vezes no botão não são duas declarações'
do $$
declare
  v_mensalidade uuid := (select id from t_mensalidades order by periodo desc limit 1);
begin
  perform pg_temp.afirmar_recusa(
    format($q$insert into public.pagamentos_declarados
              (mensalidade_id, valor, data, metodo_pagamento)
              values (%L, 100.00, current_date, 'mbway')$q$, v_mensalidade),
    'segunda declaração pendente para a mesma mensalidade');
end $$;

\echo '== Um cliente não se dá por pago'
do $$
declare v_declaracao uuid := (select id from t_declaracao);
begin
  perform pg_temp.afirmar_sem_efeito(
    format($q$update public.pagamentos_declarados set estado = 'confirmada' where id = %L$q$,
           v_declaracao),
    'o cliente não altera o estado da sua declaração');

  perform pg_temp.afirmar(
    (select estado from public.pagamentos_declarados where id = v_declaracao) = 'pendente',
    'e continua pendente');

  -- A função é de todos; o que a trava é a RLS de `recebimentos` — a guarda
  -- lá dentro serve só para a mensagem dizer a verdade.
  -- (ver o comentário em `confirmar_pagamento_declarado`)
  perform pg_temp.afirmar_recusa(
    format($q$select public.confirmar_pagamento_declarado(%L, %L)$q$,
           v_declaracao, '11111111-0000-4000-8000-000000000001'),
    'o cliente não confirma a própria declaração');

  perform pg_temp.afirmar(
    (select count(*) from public.recebimentos
      where mensalidade_id = (select id from t_mensalidades order by periodo desc limit 1)) = 0,
    'e a tentativa não deixou dinheiro lançado');
end $$;
reset role;

\echo '== Cada um vê as suas, e a equipa não vê nenhuma'
set request.jwt.claim.sub = :tiago_user;
set role authenticated;
do $$
declare
  v_mensalidade uuid := (select id from t_mensalidades order by periodo desc limit 1);
begin
  perform pg_temp.afirmar(
    (select count(*) from public.pagamentos_declarados) = 0,
    'o Tiago não vê a declaração da Sónia');

  perform pg_temp.afirmar_recusa(
    format($q$insert into public.pagamentos_declarados
              (mensalidade_id, valor, data, metodo_pagamento)
              values (%L, 100.00, current_date, 'dinheiro')$q$, v_mensalidade),
    'o Tiago não declara contra a mensalidade da Sónia');
end $$;
reset role;

set request.jwt.claim.sub = :rui;
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(
    (select count(*) from public.pagamentos_declarados) = 0,
    'o tratador não vê declarações de pagamento (é financeiro)');
end $$;
reset role;

\echo '== A gestão confirma, e é aí que nasce o dinheiro'
set request.jwt.claim.sub = :maria;
set role authenticated;
do $$
declare
  v_declaracao  uuid := (select id from t_declaracao);
  v_mensalidade uuid := (select id from t_mensalidades order by periodo desc limit 1);
  v_recebimento uuid;
begin
  perform pg_temp.afirmar(
    (select valor_em_falta from public.v_pagamentos_por_confirmar
      where declaracao_id = v_declaracao) = 100.00,
    'a vista mostra o que falta do item, para comparar com o declarado');

  select public.confirmar_pagamento_declarado(
    v_declaracao, '11111111-0000-4000-8000-000000000001')
    into v_recebimento;

  perform pg_temp.afirmar(
    (select valor from public.recebimentos where id = v_recebimento) = 100.00,
    'confirmar cria o recebimento com o valor declarado');

  perform pg_temp.afirmar(
    (select mensalidade_id from public.recebimentos where id = v_recebimento)
      = v_mensalidade,
    'e imputa-o à mensalidade certa');

  perform pg_temp.afirmar(
    (select estado from public.mensalidades_penso where id = v_mensalidade) = 'paga',
    'só agora a mensalidade fica paga — pela trigger de sempre');

  perform pg_temp.afirmar(
    (select estado = 'confirmada' and recebimento_id = v_recebimento
       and decidido_em is not null
       and decidido_por = (select id from public.pessoas
                            where email = 'maria@quintadafigueira.pt')
       from public.pagamentos_declarados where id = v_declaracao),
    'a declaração fica confirmada, com o recebimento e quem decidiu');

  perform pg_temp.afirmar(
    (select count(*) from public.v_pagamentos_por_confirmar
      where declaracao_id = v_declaracao) = 0,
    'e sai da lista de por confirmar');

  perform pg_temp.afirmar_recusa(
    format($q$select public.confirmar_pagamento_declarado(%L, %L)$q$,
           v_declaracao, '11111111-0000-4000-8000-000000000001'),
    'confirmar a mesma declaração duas vezes');
end $$;

\echo '== Recusar não cria dinheiro nenhum'
reset role;
set request.jwt.claim.sub = :sonia_user;
set role authenticated;
do $$
declare
  v_mensalidade uuid := (select id from t_mensalidades order by periodo desc offset 1 limit 1);
  v_declaracao  uuid;
begin
  insert into public.pagamentos_declarados
    (mensalidade_id, valor, data, metodo_pagamento)
  values (v_mensalidade, 100.00, current_date, 'transferencia')
  returning id into v_declaracao;
  create temporary table t_recusada as select v_declaracao as id, v_mensalidade as mensalidade;
end $$;
reset role;

set request.jwt.claim.sub = :maria;
set role authenticated;
do $$
declare
  v_declaracao  uuid := (select id from t_recusada);
  v_mensalidade uuid := (select mensalidade from t_recusada);
begin
  update public.pagamentos_declarados
     set estado = 'recusada', motivo = 'Não entrou nada na conta até hoje.'
   where id = v_declaracao;

  perform pg_temp.afirmar(
    (select count(*) from public.recebimentos where mensalidade_id = v_mensalidade) = 0,
    'recusar não lança recebimento');

  perform pg_temp.afirmar(
    (select estado from public.mensalidades_penso where id = v_mensalidade) = 'pendente',
    'e a mensalidade fica por pagar, como estava');

  perform pg_temp.afirmar(
    (select decidido_em is not null and decidido_por is not null
       from public.pagamentos_declarados where id = v_declaracao),
    'a decisão também é carimbada ao recusar');

  -- Recusada liberta o índice: o cliente pode declarar outra vez, com a
  -- referência certa desta vez.
  perform pg_temp.afirmar(
    (select count(*) from public.pagamentos_declarados
      where mensalidade_id = v_mensalidade and estado = 'pendente') = 0,
    'uma recusada não bloqueia uma declaração nova');
end $$;
reset role;

\echo '== Retirar: o próprio enquanto ninguém decidiu'
set request.jwt.claim.sub = :sonia_user;
set role authenticated;
do $$
declare
  v_mensalidade uuid := (select id from t_mensalidades order by periodo asc limit 1);
  v_declaracao  uuid;
  v_confirmada  uuid := (select id from t_declaracao);
begin
  insert into public.pagamentos_declarados
    (mensalidade_id, valor, data, metodo_pagamento)
  values (v_mensalidade, 100.00, current_date, 'dinheiro')
  returning id into v_declaracao;

  delete from public.pagamentos_declarados where id = v_declaracao;

  perform pg_temp.afirmar(
    (select count(*) from public.pagamentos_declarados where id = v_declaracao) = 0,
    'o cliente retira a sua declaração enquanto está pendente');

  perform pg_temp.afirmar_sem_efeito(
    format($q$delete from public.pagamentos_declarados where id = %L$q$, v_confirmada),
    'mas não apaga uma que a gestão já confirmou');
end $$;
reset role;

\echo '== Testes de declarações de pagamento: todos passaram'
