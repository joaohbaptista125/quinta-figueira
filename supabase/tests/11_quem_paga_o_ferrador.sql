-- =============================================================================
-- Quem paga o ferrador: quem pode escrever a ferração, e quem não pode.
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

\set maria '''99999999-0000-4000-8000-00000000000a'''
\set sonia_user '''99999999-0000-4000-8000-00000000000c'''
\set tiago_user '''99999999-0000-4000-8000-00000000000d'''
\set sonia '''22222222-0000-4000-8000-000000000003'''

-- --- Terreno: dois cavalos da Sónia, um de cada arranjo ---------------------
set request.jwt.claim.sub = :maria;
set role authenticated;
do $$
declare
  v_dele uuid;
  v_centro uuid;
begin
  insert into public.cavalos (nome, sexo, proprietario_id, regime, ferrador_pago_por)
  values ('Paga o Dono', 'castrado',
          '22222222-0000-4000-8000-000000000003', 'penso', 'proprietario')
  returning id into v_dele;

  insert into public.cavalos (nome, sexo, proprietario_id, regime)
  values ('Paga o Centro', 'femea',
          '22222222-0000-4000-8000-000000000003', 'penso')
  returning id into v_centro;

  perform pg_temp.afirmar(
    (select ferrador_pago_por from public.cavalos where id = v_centro) = 'centro',
    'por omissão quem paga o ferrador é o centro');

  create temporary table t_cavalos as
    select v_dele as dele, v_centro as centro;
end $$;
reset role;

\echo '== O dono regista a ferração do cavalo que ele próprio paga'
set request.jwt.claim.sub = :sonia_user;
set role authenticated;
do $$
declare
  v_dele uuid := (select dele from t_cavalos);
  v_ferracao uuid;
begin
  insert into public.ferracoes (cavalo_id, data, tipo, ferrador, proxima_em)
  values (v_dele, current_date, 'completa', 'Sr. Vasco', current_date + 42)
  returning id into v_ferracao;

  perform pg_temp.afirmar(
    (select ferrador from public.ferracoes where id = v_ferracao) = 'Sr. Vasco',
    'escreve o nome do ferrador');

  perform pg_temp.afirmar(
    (select pago_em is null from public.ferracoes where id = v_ferracao),
    'e nasce por pagar');

  update public.ferracoes set pago_em = current_date where id = v_ferracao;

  perform pg_temp.afirmar(
    (select pago_em = current_date from public.ferracoes where id = v_ferracao),
    'e é ele a dizer que pagou');
end $$;

\echo '== Mas só nesse: o resto continua a ser registo do centro'
do $$
declare
  v_centro uuid := (select centro from t_cavalos);
begin
  perform pg_temp.afirmar_recusa(
    format($q$insert into public.ferracoes (cavalo_id, ferrador)
             values (%L, 'Sr. Vasco')$q$, v_centro),
    'o dono não regista ferração num cavalo que o centro paga');
end $$;
reset role;

\echo '== E nem toca nos cavalos de outra pessoa'
set request.jwt.claim.sub = :tiago_user;
set role authenticated;
do $$
declare v_dele uuid := (select dele from t_cavalos);
begin
  perform pg_temp.afirmar_recusa(
    format($q$insert into public.ferracoes (cavalo_id, ferrador)
             values (%L, 'Eu')$q$, v_dele),
    'o Tiago não regista ferração no cavalo da Sónia');

  perform pg_temp.afirmar(
    (select count(*) from public.ferracoes where cavalo_id = v_dele) = 0,
    'e nem sequer vê as ferrações dele');
end $$;
reset role;

\echo '== A equipa continua a poder tudo'
set request.jwt.claim.sub = :maria;
set role authenticated;
do $$
declare
  v_centro uuid := (select centro from t_cavalos);
  v_ferracao uuid;
begin
  insert into public.ferracoes (cavalo_id, ferrador, custo)
  values (v_centro, 'Sr. Vasco', 60.00)
  returning id into v_ferracao;

  perform pg_temp.afirmar(
    (select count(*) from public.ferracoes where id = v_ferracao) = 1,
    'a equipa regista no cavalo que o centro paga');

  delete from public.ferracoes where id = v_ferracao;

  perform pg_temp.afirmar(
    (select count(*) from public.ferracoes where id = v_ferracao) = 0,
    'e apaga, que é o que o proprietário não pode fazer');
end $$;
reset role;

\echo '== Testes de quem paga o ferrador: todos passaram'
