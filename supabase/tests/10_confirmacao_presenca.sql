-- =============================================================================
-- «Vou»/«não vou»: o que o atleta pode dizer, e o que só a equipa pode escrever
-- Corre depois de 01_rls.sql, que já criou as contas de acesso.
-- =============================================================================
-- A frase que estes testes guardam: **confirmar não é estar presente**. Se um
-- dia alguém ligar `confirmacao` a `estado` «para poupar um clique», é aqui
-- que rebenta — e o que se perde é o registo de assiduidade do centro.

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

\set maria '''99999999-0000-4000-8000-00000000000a'''
\set sonia_user '''99999999-0000-4000-8000-00000000000c'''
\set tiago_user '''99999999-0000-4000-8000-00000000000d'''
\set sonia '''22222222-0000-4000-8000-000000000003'''
\set tiago '''22222222-0000-4000-8000-000000000004'''

-- --- Terreno: uma aula com a Sónia e o Tiago convocados ---------------------
set request.jwt.claim.sub = :maria;
set role authenticated;
do $$
declare v_evento uuid;
begin
  insert into public.eventos (tipo, data, hora_inicio, hora_fim)
  values ('aula', current_date + 3, '18:30', '19:30')
  returning id into v_evento;

  insert into public.evento_participantes (evento_id, pessoa_id) values
    (v_evento, '22222222-0000-4000-8000-000000000003'),
    (v_evento, '22222222-0000-4000-8000-000000000004');

  create temporary table t_aula as select v_evento as id;

  perform pg_temp.afirmar(
    (select count(*) from public.evento_participantes
      where evento_id = v_evento and confirmacao = 'sem_resposta') = 2,
    'uma convocatória nasce sem resposta');
end $$;
reset role;

\echo '== O atleta responde, e a resposta não é presença'
set request.jwt.claim.sub = :sonia_user;
set role authenticated;
do $$
declare v_evento uuid := (select id from t_aula);
begin
  update public.evento_participantes
     set confirmacao = 'vai'
   where evento_id = v_evento
     and pessoa_id = '22222222-0000-4000-8000-000000000003';

  perform pg_temp.afirmar(
    (select confirmacao from public.evento_participantes
      where evento_id = v_evento
        and pessoa_id = '22222222-0000-4000-8000-000000000003') = 'vai',
    'a Sónia confirma que vai');

  perform pg_temp.afirmar(
    (select confirmado_em is not null from public.evento_participantes
      where evento_id = v_evento
        and pessoa_id = '22222222-0000-4000-8000-000000000003'),
    'e a hora da resposta é carimbada');

  -- O coração disto tudo.
  perform pg_temp.afirmar(
    (select estado from public.evento_participantes
      where evento_id = v_evento
        and pessoa_id = '22222222-0000-4000-8000-000000000003') = 'convocado',
    'confirmar NÃO mexe no estado de presença');
end $$;

\echo '== E não lhe dá a caneta para escrever mais nada'
do $$
declare
  v_evento uuid := (select id from t_aula);
  v_cavalo uuid := (select id from public.cavalos limit 1);
begin
  -- A RLS deixa passar a linha (é dela); é a trigger que repõe as colunas.
  update public.evento_participantes
     set estado = 'presente',
         cavalo_id = v_cavalo,
         notas = 'escrevi eu'
   where evento_id = v_evento
     and pessoa_id = '22222222-0000-4000-8000-000000000003';

  perform pg_temp.afirmar(
    (select estado from public.evento_participantes
      where evento_id = v_evento
        and pessoa_id = '22222222-0000-4000-8000-000000000003') = 'convocado',
    'o atleta não se põe a si próprio como presente');

  perform pg_temp.afirmar(
    (select cavalo_id is null and notas is null
       from public.evento_participantes
      where evento_id = v_evento
        and pessoa_id = '22222222-0000-4000-8000-000000000003'),
    'nem se atribui um cavalo, nem escreve nas notas da equipa');

  perform pg_temp.afirmar_sem_efeito(
    format($q$update public.evento_participantes set confirmacao = 'nao_vai'
             where evento_id = %L
               and pessoa_id = '22222222-0000-4000-8000-000000000004'$q$, v_evento),
    'e não responde pelo Tiago');

  perform pg_temp.afirmar_sem_efeito(
    format($q$delete from public.evento_participantes
             where evento_id = %L
               and pessoa_id = '22222222-0000-4000-8000-000000000003'$q$, v_evento),
    'nem se desconvoca a si próprio');
end $$;
reset role;

\echo '== A equipa continua a escrever o que aconteceu'
set request.jwt.claim.sub = :tiago_user;
set role authenticated;
do $$
declare v_evento uuid := (select id from t_aula);
begin
  update public.evento_participantes
     set confirmacao = 'nao_vai', motivo_ausencia = 'Estou fora nessa semana.'
   where evento_id = v_evento
     and pessoa_id = '22222222-0000-4000-8000-000000000004';

  perform pg_temp.afirmar(
    (select confirmacao = 'nao_vai' and motivo_ausencia is not null
       from public.evento_participantes
      where evento_id = v_evento
        and pessoa_id = '22222222-0000-4000-8000-000000000004'),
    'o Tiago diz que não vai, e porquê');
end $$;
reset role;

set request.jwt.claim.sub = :maria;
set role authenticated;
do $$
declare v_evento uuid := (select id from t_aula);
begin
  update public.evento_participantes
     set estado = 'faltou'
   where evento_id = v_evento
     and pessoa_id = '22222222-0000-4000-8000-000000000004';

  perform pg_temp.afirmar(
    (select estado = 'faltou' and confirmacao = 'nao_vai'
       from public.evento_participantes
      where evento_id = v_evento
        and pessoa_id = '22222222-0000-4000-8000-000000000004'),
    'marcar a falta não apaga o que ele tinha respondido');

  perform pg_temp.afirmar(
    (select count(*) from public.evento_participantes
      where evento_id = v_evento and confirmacao = 'sem_resposta') = 0,
    'e já ninguém está por responder neste evento');
end $$;
reset role;

\echo '== Testes de confirmação de presença: todos passaram'
