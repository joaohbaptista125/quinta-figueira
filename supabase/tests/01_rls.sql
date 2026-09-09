-- =============================================================================
-- Testes do esquema: RLS, restrições de integridade e colunas calculadas.
-- Corre depois das migrações e do seed. Ver scripts/validar-esquema.sh.
-- Qualquer falha lança excepção e interrompe o script.
-- =============================================================================

\set ON_ERROR_STOP on
\set QUIET on
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
  raise exception 'FALHOU: % — a operação foi aceite e devia ter sido recusada', p_descricao;
end $$;

-- Em UPDATE/DELETE a RLS não lança erro: simplesmente não encontra linhas.
-- Isso é o comportamento correcto, por isso testa-se o número de linhas afectadas.
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

-- --- Contas de acesso para o teste ------------------------------------------
-- A trigger em auth.users liga cada utilizador à pessoa com o mesmo email.
insert into auth.users (id, email) values
  ('99999999-0000-4000-8000-00000000000a', 'maria@quintadafigueira.pt'),
  ('99999999-0000-4000-8000-00000000000b', 'rui@quintadafigueira.pt'),
  ('99999999-0000-4000-8000-00000000000c', 'sonia@exemplo.pt'),
  ('99999999-0000-4000-8000-00000000000d', 'tiago@exemplo.pt');

do $$
begin
  perform pg_temp.afirmar(
    (select count(*) from public.pessoas where auth_user_id is not null) = 4,
    'a trigger de auth.users ligou as 4 contas às pessoas pelo email');
  perform pg_temp.afirmar(
    (select perfil from public.pessoas where email = 'maria@quintadafigueira.pt') = 'admin',
    'a ligação automática não sobrepõe o perfil já definido');
end $$;

-- --- Integridade ------------------------------------------------------------
\echo '== Restrições de integridade'
do $$
begin
  -- IVA: 738,00 EUR a 6% => base 696,23 + IVA 41,77
  perform pg_temp.afirmar(
    (select valor_base = 696.23 and valor_iva = 41.77
       from public.despesas where valor_total = 738.00 and taxa_iva = 6.00),
    'colunas calculadas de IVA (738,00 a 6% => 696,23 + 41,77)');

  perform pg_temp.afirmar(
    (select valor_base + valor_iva = valor_total from public.despesas
      order by valor_total desc limit 1),
    'base + IVA reconstitui sempre o total');

  perform pg_temp.afirmar(
    (select data_pagamento is not null from public.despesas where paga limit 1)
    and (select bool_and(data_pagamento is null) from public.despesas where not paga),
    'data_pagamento é preenchida/limpa conforme o campo paga');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.cavalos (nome, regime) values ('Sem Dono', 'penso')$q$,
    'cavalo a penso sem proprietário é recusado');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.contratos_penso (cavalo_id, cliente_id, valor_mensal, data_inicio)
       values ('33333333-0000-4000-8000-000000000001',
               '22222222-0000-4000-8000-000000000003', 300, current_date - 10)$q$,
    'contrato de penso sobreposto para o mesmo cavalo é recusado');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.mensalidades_penso (contrato_id, periodo, valor)
       values ('44444444-0000-4000-8000-000000000001', current_date - 3, 100)$q$,
    'mensalidade com período que não é o dia 1 do mês é recusada');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.recebimentos
         (pessoa_id, valor, metodo_pagamento, conta_id, tipo, mensalidade_id)
       select '22222222-0000-4000-8000-000000000003', 10, 'dinheiro',
              '11111111-0000-4000-8000-000000000001', 'aulas', id
         from public.mensalidades_penso limit 1$q$,
    'recebimento ligado a mensalidade tem de ser do tipo penso');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.pessoas (nome, nif) values ('NIF Curto', '123')$q$,
    'NIF com formato inválido é recusado');
end $$;

-- --- Mensalidades: estado automático ----------------------------------------
\echo '== Mensalidades'
do $$
declare v_id uuid;
begin
  perform pg_temp.afirmar(
    (select estado from public.mensalidades_penso
      where contrato_id = '44444444-0000-4000-8000-000000000001'
        and periodo = date_trunc('month', current_date)::date) = 'paga',
    'mensalidade passa a paga quando o recebimento a cobre');

  perform pg_temp.afirmar(
    (select count(*) from public.mensalidades_penso
      where periodo = date_trunc('month', current_date)::date
        and estado = 'pendente') = 2,
    'ficam 2 pensos pendentes no mês corrente');

  -- Um recebimento parcial não fecha a mensalidade.
  select id into v_id from public.mensalidades_penso
   where contrato_id = '44444444-0000-4000-8000-000000000003'
     and periodo = date_trunc('month', current_date)::date;

  insert into public.recebimentos
    (pessoa_id, valor, metodo_pagamento, conta_id, tipo, mensalidade_id, periodo)
  values ('22222222-0000-4000-8000-000000000004', 100.00, 'dinheiro',
          '11111111-0000-4000-8000-000000000001', 'penso', v_id,
          date_trunc('month', current_date)::date);

  perform pg_temp.afirmar(
    (select estado from public.mensalidades_penso where id = v_id) = 'pendente',
    'pagamento parcial mantém a mensalidade pendente');
  perform pg_temp.afirmar(
    (select valor_em_falta from public.v_pensos_por_receber
      where mensalidade_id = v_id) = 210.00,
    'v_pensos_por_receber calcula o valor em falta (310,00 - 100,00)');

  delete from public.recebimentos where mensalidade_id = v_id and valor = 100.00;

  perform pg_temp.afirmar(
    (select estado from public.mensalidades_penso where id = v_id) = 'pendente',
    'apagar o recebimento devolve a mensalidade a pendente');
end $$;

-- --- Cobertura de RLS -------------------------------------------------------
\echo '== Cobertura de RLS'
do $$
declare v_sem_rls text;
begin
  select string_agg(c.relname, ', ') into v_sem_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  perform pg_temp.afirmar(v_sem_rls is null,
    'todas as tabelas de public têm RLS activa' ||
    coalesce(' (em falta: ' || v_sem_rls || ')', ''));

  select string_agg(c.relname, ', ') into v_sem_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and not exists (select 1 from pg_policy p where p.polrelid = c.oid);
  perform pg_temp.afirmar(v_sem_rls is null,
    'todas as tabelas de public têm pelo menos uma política' ||
    coalesce(' (em falta: ' || v_sem_rls || ')', ''));

  perform pg_temp.afirmar(
    (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'v'
        and coalesce(c.reloptions::text, '') not like '%security_invoker=on%') = 0,
    'todas as vistas de public têm security_invoker activo');
end $$;

-- --- admin (Maria) ----------------------------------------------------------
\echo '== Perfil admin'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000a';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(public.e_gestao(), 'admin é reconhecido como gestão');
  perform pg_temp.afirmar((select count(*) from public.cavalos) = 5,
    'admin vê os 5 cavalos');
  perform pg_temp.afirmar((select count(*) from public.despesas) = 6,
    'admin vê as 6 despesas');
  perform pg_temp.afirmar((select count(*) from public.contas) = 2,
    'admin vê as 2 contas');
  -- Caixa: 350,00 + 0 recebido - 270,00 (ferrador) = 80,00
  perform pg_temp.afirmar(
    (select saldo_actual from public.v_saldos_contas where nome = 'Caixa') = 80.00,
    'v_saldos_contas calcula o saldo de Caixa (350,00 - 270,00 = 80,00)');
  -- Serradura (615,00) está por pagar, logo não desconta do saldo do banco.
  perform pg_temp.afirmar(
    (select total_despesas - total_despesas_pagas from public.v_resumo_mensal
      where periodo = date_trunc('month', current_date)::date) = 615.00,
    'v_resumo_mensal separa despesas lançadas de despesas pagas');
end $$;
reset role;

-- --- instrutor (Rui): cadastro sim, financeiro não --------------------------
\echo '== Perfil instrutor'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000b';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(public.e_equipa() and not public.e_gestao(),
    'instrutor é equipa mas não é gestão');
  perform pg_temp.afirmar((select count(*) from public.cavalos) = 5,
    'instrutor vê todos os cavalos');
  perform pg_temp.afirmar((select count(*) from public.pessoas) = 5,
    'instrutor vê todas as pessoas');
  perform pg_temp.afirmar((select count(*) from public.despesas) = 0,
    'instrutor NÃO vê despesas');
  perform pg_temp.afirmar((select count(*) from public.contas) = 0,
    'instrutor NÃO vê contas');
  perform pg_temp.afirmar((select count(*) from public.recebimentos) = 0,
    'instrutor NÃO vê recebimentos');
  perform pg_temp.afirmar((select count(*) from public.contratos_penso) = 0,
    'instrutor NÃO vê contratos de penso (contêm valores)');
  perform pg_temp.afirmar((select count(*) from public.v_saldos_contas) = 0,
    'instrutor NÃO vê saldos através da vista');
  perform pg_temp.afirmar_recusa(
    $q$insert into public.cavalos (nome, regime) values ('Intruso', 'escola')$q$,
    'instrutor não pode criar cavalos');
end $$;
reset role;

-- --- cliente (Sónia) --------------------------------------------------------
\echo '== Perfil cliente'
-- Ids reais capturados enquanto ainda há visibilidade total, para os testes de
-- escrita não passarem por acaso ao não encontrarem linhas para inserir.
create temp table ids_conhecidos as
  select (select id from public.categorias_despesa where slug = 'racao') as categoria_id,
         '11111111-0000-4000-8000-000000000001'::uuid                    as conta_id;
grant select on ids_conhecidos to public;

set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000c';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(not public.e_equipa() and not public.e_gestao(),
    'cliente não é equipa nem gestão');
  perform pg_temp.afirmar((select count(*) from public.cavalos) = 2,
    'cliente vê apenas os seus 2 cavalos');
  perform pg_temp.afirmar(
    (select bool_and(proprietario_id = public.pessoa_actual_id())
       from public.cavalos),
    'todos os cavalos visíveis ao cliente são dele');
  perform pg_temp.afirmar((select count(*) from public.pessoas) = 1,
    'cliente vê apenas a sua própria ficha');
  perform pg_temp.afirmar((select count(*) from public.despesas) = 0,
    'cliente NÃO vê despesas do centro');
  perform pg_temp.afirmar((select count(*) from public.contas) = 0,
    'cliente NÃO vê contas');
  perform pg_temp.afirmar((select count(*) from public.fornecedores) = 0,
    'cliente NÃO vê fornecedores');
  perform pg_temp.afirmar((select count(*) from public.contratos_penso) = 2,
    'cliente vê os seus 2 contratos de penso');
  perform pg_temp.afirmar((select count(*) from public.mensalidades_penso) = 2,
    'cliente vê apenas as suas mensalidades');
  perform pg_temp.afirmar((select count(*) from public.recebimentos) = 1,
    'cliente vê apenas o seu recebimento');
  perform pg_temp.afirmar((select count(*) from public.boxes) = 2,
    'cliente vê apenas as boxes dos seus cavalos');
  perform pg_temp.afirmar((select count(*) from public.v_pensos_por_receber) = 2,
    'cliente vê apenas os seus pensos na vista');

  -- Usa ids capturados antes da mudança de perfil: um insert cujo SELECT não
  -- devolve linhas "passa" sem provar nada.
  perform pg_temp.afirmar_recusa(
    format($q$insert into public.despesas
         (categoria_id, descricao, valor_total, metodo_pagamento, conta_id)
       values (%L, 'Fraude', 1, 'dinheiro', %L)$q$,
       (select categoria_id from pg_temp.ids_conhecidos),
       (select conta_id from pg_temp.ids_conhecidos)),
    'cliente não pode lançar despesas');
  perform pg_temp.afirmar_recusa(
    $q$insert into public.cavalos (nome, regime) values ('Intruso', 'escola')$q$,
    'cliente não pode criar cavalos');

  -- A RLS bloqueia estes casos sem erro, não encontrando as linhas.
  perform pg_temp.afirmar_sem_efeito(
    $q$update public.pessoas set perfil = 'admin'
        where id = public.pessoa_actual_id()$q$,
    'cliente não se pode promover a admin');
  perform pg_temp.afirmar_sem_efeito(
    format($q$update public.mensalidades_penso set estado = 'paga'
             where periodo = %L$q$, date_trunc('month', current_date)::date),
    'cliente não pode dar as suas mensalidades por pagas');
  perform pg_temp.afirmar_sem_efeito(
    $q$delete from public.recebimentos$q$,
    'cliente não pode apagar recebimentos');

  perform pg_temp.afirmar(
    (select perfil from public.pessoas where id = public.pessoa_actual_id()) = 'cliente',
    'o perfil do cliente manteve-se inalterado');
end $$;
reset role;

-- --- cliente (Tiago): não vê os dados da Sónia ------------------------------
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000d';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar((select count(*) from public.cavalos) = 1,
    'o segundo cliente vê apenas o seu cavalo');
  perform pg_temp.afirmar(
    (select count(*) from public.recebimentos
      where pessoa_id <> public.pessoa_actual_id()) = 0,
    'um cliente nunca vê recebimentos de outro cliente');
  perform pg_temp.afirmar(
    (select count(*) from public.pessoas
      where email = 'sonia@exemplo.pt') = 0,
    'um cliente não consegue ler a ficha de outro cliente');
end $$;
reset role;

-- --- Sem sessão -------------------------------------------------------------
\echo '== Sem sessão iniciada'
reset request.jwt.claim.sub;
set role anon;
do $$
begin
  perform pg_temp.afirmar((select count(*) from public.cavalos) = 0,
    'utilizador anónimo não lê cavalos');
  perform pg_temp.afirmar((select count(*) from public.pessoas) = 0,
    'utilizador anónimo não lê pessoas');
  perform pg_temp.afirmar((select count(*) from public.despesas) = 0,
    'utilizador anónimo não lê despesas');
end $$;
reset role;

\echo '== Todos os testes passaram'
