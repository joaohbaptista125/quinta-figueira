-- =============================================================================
-- Testes da ferração: quem regista, quem vê, e o estado da próxima.
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

-- O seed de desenvolvimento também mete ferrações. Aqui a contabilidade tem
-- de ser exacta, por isso partimos de uma tabela vazia.
delete from public.ferracoes;

\echo '== As regras da própria tabela'
do $$
begin
  perform pg_temp.afirmar_recusa(
    $q$insert into public.ferracoes (cavalo_id, data)
       values ('33333333-0000-4000-8000-000000000001', current_date + 1)$q$,
    'uma ferração no futuro é recusada');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.ferracoes (cavalo_id, data, proxima_em)
       values ('33333333-0000-4000-8000-000000000001',
               current_date - 10, current_date - 20)$q$,
    'a próxima ferração não pode ser antes da que acabou de ser feita');
end $$;

-- --- tratador: é quem recebe o ferrador na cavalariça ------------------------
\echo '== O tratador regista a ferração'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000b';
set role authenticated;
do $$
begin
  -- Fidalgo: ferrado há dez semanas, e a próxima já passou.
  insert into public.ferracoes (id, cavalo_id, data, tipo, proxima_em, ferrador)
  values ('88888888-0000-4000-8000-000000000001',
          '33333333-0000-4000-8000-000000000001',
          current_date - 70, 'completa', current_date - 14, 'Sr. Alberto');

  -- Estrela: ferrada a semana passada, a próxima daqui a seis semanas.
  insert into public.ferracoes (id, cavalo_id, data, tipo, proxima_em, ferrador)
  values ('88888888-0000-4000-8000-000000000002',
          '33333333-0000-4000-8000-000000000002',
          current_date - 7, 'maos', current_date + 35, 'Sr. Alberto');

  -- Bolota é da escola e não tem proprietário.
  insert into public.ferracoes (id, cavalo_id, data, tipo, proxima_em)
  values ('88888888-0000-4000-8000-000000000003',
          '33333333-0000-4000-8000-000000000004',
          current_date - 30, 'arranjo', current_date + 3);

  perform pg_temp.afirmar(
    (select count(*) from public.ferracoes) = 3,
    'a equipa regista ferrações sem precisar da gestão');
end $$;
reset role;

\echo '== A vista responde «quando foi, quando volta a ser»'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000a';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(
    (select estado from public.v_ferracao_cavalos
      where cavalo_id = '33333333-0000-4000-8000-000000000001') = 'atrasada',
    'uma próxima que já passou dá ferração atrasada');

  perform pg_temp.afirmar(
    (select estado from public.v_ferracao_cavalos
      where cavalo_id = '33333333-0000-4000-8000-000000000002') = 'em_dia',
    'uma próxima lá para a frente dá ferração em dia');

  perform pg_temp.afirmar(
    (select estado from public.v_ferracao_cavalos
      where cavalo_id = '33333333-0000-4000-8000-000000000004') = 'esta_semana',
    'uma próxima dentro de sete dias avisa que é esta semana');

  -- O que nunca foi ferrado é precisamente o que interessa ver, por isso a
  -- vista é um left join e não um inner.
  perform pg_temp.afirmar(
    (select estado from public.v_ferracao_cavalos
      where cavalo_id = '33333333-0000-4000-8000-000000000003') = 'sem_registo',
    'um cavalo sem nenhuma ferração aparece na vista, como sem registo');

  perform pg_temp.afirmar(
    (select count(*) from public.v_ferracao_cavalos) = 5,
    'a vista tem uma linha por cavalo, não uma por ferração');

  -- Duas ferrações do mesmo cavalo: a vista fica com a mais recente.
  insert into public.ferracoes (cavalo_id, data, proxima_em)
  values ('33333333-0000-4000-8000-000000000001',
          current_date - 2, current_date + 40);
  perform pg_temp.afirmar(
    (select estado from public.v_ferracao_cavalos
      where cavalo_id = '33333333-0000-4000-8000-000000000001') = 'em_dia',
    'ferrar outra vez passa o cavalo de atrasado a em dia');
end $$;
reset role;

-- --- cliente (Sónia, dona do Fidalgo e da Estrela) ---------------------------
\echo '== O cliente vê a ferração dos cavalos dele, e só'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000c';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(
    (select count(*) from public.ferracoes) = 3,
    'cliente vê as ferrações dos seus dois cavalos');

  perform pg_temp.afirmar(
    (select count(*) from public.ferracoes
      where cavalo_id = '33333333-0000-4000-8000-000000000004') = 0,
    'cliente NÃO vê a ferração de um cavalo que não é dele');

  perform pg_temp.afirmar(
    (select count(*) from public.v_ferracao_cavalos) = 2,
    'a vista também só lhe mostra os cavalos dele');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.ferracoes (cavalo_id, data)
       values ('33333333-0000-4000-8000-000000000001', current_date)$q$,
    'cliente não regista ferrações, nem as do seu próprio cavalo');

  -- Um UPDATE que a RLS não deixa ver não rebenta: não encontra linha nenhuma
  -- e passa em claro. O que se verifica é que nada mudou.
  update public.ferracoes set ferrador = 'Eu'
   where id = '88888888-0000-4000-8000-000000000001';
  perform pg_temp.afirmar(
    (select ferrador from public.ferracoes
      where id = '88888888-0000-4000-8000-000000000001') = 'Sr. Alberto',
    'cliente não altera a ferração que vê');
end $$;
reset role;

\echo '== Apagar o cavalo leva a ferração consigo'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000a';
set role authenticated;
do $$
declare v_cavalo uuid;
begin
  insert into public.cavalos (nome, regime) values ('Efémero', 'centro')
  returning id into v_cavalo;
  insert into public.ferracoes (cavalo_id, data) values (v_cavalo, current_date);

  delete from public.cavalos where id = v_cavalo;
  perform pg_temp.afirmar(
    (select count(*) from public.ferracoes where cavalo_id = v_cavalo) = 0,
    'a ferração não sobrevive ao cavalo');
end $$;
reset role;

\echo '== Testes de ferração: todos passaram'
