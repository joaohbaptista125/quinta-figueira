-- =============================================================================
-- Testes da Fase 3: eventos, convocatórias, avisos e calendário.
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

\echo '== Um cavalo num sítio de cada vez'
do $$
declare v_evento uuid;
begin
  -- A Bolota está na aula das 18h e na das 19h: não se sobrepõem.
  perform pg_temp.afirmar(
    (select count(*) from public.evento_participantes
      where cavalo_id = '33333333-0000-4000-8000-000000000004') = 2,
    'o mesmo cavalo pode estar em eventos que não se sobrepõem');

  -- Um evento novo que colide com a aula das 18h.
  insert into public.eventos (id, tipo, data, hora_inicio, hora_fim)
  values ('77777777-0000-4000-8000-0000000000ff', 'aula',
          current_date, '18:30', '19:30')
  returning id into v_evento;

  perform pg_temp.afirmar_recusa(
    format($q$insert into public.evento_participantes (evento_id, pessoa_id, cavalo_id)
             values (%L, '22222222-0000-4000-8000-000000000003',
                     '33333333-0000-4000-8000-000000000004')$q$, v_evento),
    'o mesmo cavalo em dois eventos sobrepostos é recusado');

  -- Sem cavalo não há conflito: duas pessoas podem estar à mesma hora.
  insert into public.evento_participantes (evento_id, pessoa_id)
  values (v_evento, '22222222-0000-4000-8000-000000000003');
  perform pg_temp.afirmar(true, 'participante sem cavalo não colide com nada');

  delete from public.eventos where id = v_evento;
end $$;

\echo '== Cancelar e remarcar'
do $$
declare v_evento uuid := '77777777-0000-4000-8000-000000000002';
begin
  -- Cancelar liberta o cavalo: a janela do participante passa a nula.
  update public.eventos set cancelado = true where id = v_evento;
  perform pg_temp.afirmar(
    (select periodo is null from public.evento_participantes
      where evento_id = v_evento) ,
    'cancelar um evento liberta o cavalo');

  insert into public.eventos (id, tipo, data, hora_inicio, hora_fim)
  values ('77777777-0000-4000-8000-0000000000fe', 'aula',
          current_date, '19:15', '20:15');
  insert into public.evento_participantes (evento_id, pessoa_id, cavalo_id)
  values ('77777777-0000-4000-8000-0000000000fe',
          '22222222-0000-4000-8000-000000000003',
          '33333333-0000-4000-8000-000000000004');
  perform pg_temp.afirmar(true,
    'com o evento cancelado, o cavalo fica livre para outro à mesma hora');

  -- Descancelar tem de voltar a colidir.
  perform pg_temp.afirmar_recusa(
    format($q$update public.eventos set cancelado = false where id = %L$q$, v_evento),
    'descancelar volta a detectar a sobreposição');

  -- Mover um evento para cima de outro também.
  perform pg_temp.afirmar_recusa(
    $q$update public.eventos set hora_inicio = '18:15', hora_fim = '19:15'
        where id = '77777777-0000-4000-8000-0000000000fe'$q$,
    'mover um evento para cima de outro é recusado');

  delete from public.eventos where id = '77777777-0000-4000-8000-0000000000fe';
  update public.eventos set cancelado = false where id = v_evento;
end $$;

\echo '== Integridade'
do $$
begin
  perform pg_temp.afirmar_recusa(
    $q$insert into public.evento_participantes (evento_id, pessoa_id)
       values ('77777777-0000-4000-8000-000000000001',
               '22222222-0000-4000-8000-000000000003')$q$,
    'a mesma pessoa duas vezes no mesmo evento é recusada');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.eventos (tipo, data, hora_inicio, hora_fim)
       values ('aula', current_date, '18:00', '17:00')$q$,
    'hora de fim antes da de início é recusada');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.avisos (texto) values ('sem dono')$q$,
    'um aviso sem evento nem equipa é recusado');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.avisos (evento_id, equipa_id, texto)
       values ('77777777-0000-4000-8000-000000000001',
               '66666666-0000-4000-8000-000000000001', 'dois donos')$q$,
    'um aviso com evento E equipa é recusado');
end $$;

\echo '== Calendário'
do $$
declare v_token uuid;
begin
  insert into public.calendarios (pessoa_id)
  values ('22222222-0000-4000-8000-000000000004')
  returning token into v_token;

  perform pg_temp.afirmar(
    (select count(*) from public.agenda_por_token(v_token)) >= 2,
    'a agenda por token devolve os eventos da pessoa');

  perform pg_temp.afirmar(
    (select bool_or(avisos is not null) from public.agenda_por_token(v_token)),
    'os avisos do evento vão no ficheiro do calendário');

  perform pg_temp.afirmar(
    (select count(*) from public.agenda_por_token(gen_random_uuid())) = 0,
    'um token desconhecido não devolve nada');

  -- O responsável vê no calendário os eventos que orienta.
  insert into public.calendarios (pessoa_id)
  values ('22222222-0000-4000-8000-000000000002');
  perform pg_temp.afirmar(
    (select count(*) from public.agenda_por_token(
       (select token from public.calendarios
         where pessoa_id = '22222222-0000-4000-8000-000000000002'))) >= 3,
    'o instrutor vê no calendário os eventos de que é responsável');
end $$;

\echo '== RLS dos eventos'

-- Instrutor: planeia o dia.
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000b';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(public.e_instrutor_ou_gestao(),
    'instrutor pode planear');
  perform pg_temp.afirmar((select count(*) from public.eventos) >= 3,
    'instrutor vê todos os eventos');
  insert into public.eventos (id, tipo, data, hora_inicio)
  values ('77777777-0000-4000-8000-0000000000fd', 'aula', current_date + 7, '10:00');
  perform pg_temp.afirmar(true, 'instrutor cria eventos');
  delete from public.eventos where id = '77777777-0000-4000-8000-0000000000fd';
end $$;
reset role;

-- Cliente: só o que é dele.
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000c';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(not public.e_instrutor_ou_gestao(),
    'cliente não pode planear');
  perform pg_temp.afirmar(
    (select count(*) from public.eventos) = 1,
    'cliente vê apenas o evento em que está convocado');
  perform pg_temp.afirmar(
    (select count(*) from public.equipas) = 1,
    'cliente vê apenas a equipa de que é membro');
  perform pg_temp.afirmar(
    (select count(*) from public.calendarios) = 0,
    'cliente não vê tokens de calendário de outras pessoas');
  perform pg_temp.afirmar_recusa(
    $q$insert into public.eventos (tipo, data, hora_inicio)
       values ('aula', current_date + 3, '11:00')$q$,
    'cliente não pode criar eventos');
end $$;
reset role;

-- O outro cliente vê os colegas de convocatória, e mais ninguém.
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000d';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(
    (select count(*) from public.eventos) = 2,
    'o jogador vê a aula e o treino em que está');
  perform pg_temp.afirmar(
    (select count(*) from public.avisos) = 1,
    'o jogador lê o aviso do treino em que está convocado');
end $$;
reset role;

\echo '== Testes de eventos: todos passaram'
