-- =============================================================================
-- O cliente inscreve o cavalo; quem aprova é a gestão
-- =============================================================================
-- Corre depois de 01_rls.sql, que já criou as contas de acesso.
--
-- O que aqui se prova é o que a RLS sozinha **não** conseguia garantir: ela
-- decide linhas, e o que era preciso travar eram colunas. Um cliente que
-- pudesse escrever `aprovado_em` aprovava-se a si próprio; um que pudesse
-- escolher `proprietario_id` inscrevia um cavalo em nome de outro. Quem o
-- limita é a trigger `carimbar_cavalo_proposto`.

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

\echo '== O que já existia nasceu aprovado'
set role postgres;
do $$
begin
  perform pg_temp.afirmar(
    (select count(*) from public.cavalos where aprovado_em is null) = 0,
    'a migração não deixou nenhum cavalo antigo por aprovar');

  -- O seed corre sem sessão, e aí não há proposta nenhuma a considerar.
  perform pg_temp.afirmar(
    (select count(*) from public.cavalos where aprovado_em is not null) >= 5,
    'os cavalos do seed estão todos aprovados');
end $$;
reset role;

\echo '== A Sónia inscreve um cavalo, e ele fica por aprovar'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000c';
set role authenticated;
do $$
declare v_cavalo uuid;
begin
  -- De propósito a mentir em tudo o que não é dela: regime de escola, cavalo
  -- em nome do Tiago, e já aprovado. A trigger reescreve as três coisas.
  insert into public.cavalos (nome, regime, proprietario_id, aprovado_em)
  values ('Relâmpago', 'escola', '22222222-0000-4000-8000-000000000004', now())
  returning id into v_cavalo;

  perform pg_temp.afirmar(
    (select aprovado_em is null from public.cavalos where id = v_cavalo),
    'ninguém se aprova a si próprio, mesmo mandando a data no INSERT');

  perform pg_temp.afirmar(
    (select proprietario_id from public.cavalos where id = v_cavalo)
      = '22222222-0000-4000-8000-000000000003',
    'a proposta sai sempre em nome de quem a escreve');

  perform pg_temp.afirmar(
    (select regime from public.cavalos where id = v_cavalo) = 'penso',
    'e sempre a penso — o regime diz de quem é o cavalo, e isso não é do cliente');

  -- Enquanto ninguém decidiu, corrigir o que escreveu há dois minutos não
  -- devia obrigar a pedir a alguém.
  update public.cavalos set raca = 'Lusitano' where id = v_cavalo;
  perform pg_temp.afirmar(
    (select raca from public.cavalos where id = v_cavalo) = 'Lusitano',
    'o dono corrige a proposta enquanto ela está pendente');

  -- Mas a correcção não é a ocasião para se aprovar sozinho.
  update public.cavalos
     set aprovado_em = now(),
         proprietario_id = '22222222-0000-4000-8000-000000000004',
         regime = 'centro'
   where id = v_cavalo;

  perform pg_temp.afirmar(
    (select aprovado_em is null
        and proprietario_id = '22222222-0000-4000-8000-000000000003'
        and regime = 'penso'
       from public.cavalos where id = v_cavalo),
    'a correcção não lhe deixa mexer na aprovação, no dono nem no regime');

  perform pg_temp.afirmar_sem_efeito(
    $q$update public.cavalos set nome = 'Roubado'
        where id = '33333333-0000-4000-8000-000000000003'$q$,
    'e não toca no cavalo de outra pessoa');
end $$;
reset role;

\echo '== A gestão aprova, e a partir daí o cliente deixa de escrever'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000a';
set role authenticated;
do $$
declare v_cavalo uuid;
begin
  select id into v_cavalo from public.cavalos where nome = 'Relâmpago';

  perform pg_temp.afirmar(
    (select count(*) from public.cavalos where aprovado_em is null) = 1,
    'a gestão vê a proposta na lista do que falta aprovar');

  update public.cavalos
     set aprovado_em = now(),
         aprovado_por = public.pessoa_actual_id()
   where id = v_cavalo;

  perform pg_temp.afirmar(
    (select aprovado_em is not null from public.cavalos where id = v_cavalo),
    'a gestão aprova — a ela a trigger não lhe toca');
end $$;
reset role;

set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000c';
set role authenticated;
do $$
declare v_cavalo uuid;
begin
  select id into v_cavalo from public.cavalos where nome = 'Relâmpago';

  perform pg_temp.afirmar_sem_efeito(
    format($q$update public.cavalos set nome = 'Outro' where id = %L$q$, v_cavalo),
    'depois de aprovado o dono já não escreve na ficha');

  perform pg_temp.afirmar_sem_efeito(
    format($q$delete from public.cavalos where id = %L$q$, v_cavalo),
    'nem a apaga — a correcção passa a ser uma nota');
end $$;
reset role;

\echo '== Uma proposta apaga-se enquanto ninguém decidiu'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000d';
set role authenticated;
do $$
declare v_cavalo uuid;
begin
  insert into public.cavalos (nome, regime) values ('Engano', 'penso')
  returning id into v_cavalo;

  perform pg_temp.afirmar(
    (select proprietario_id from public.cavalos where id = v_cavalo)
      = '22222222-0000-4000-8000-000000000004',
    'o Tiago inscreve sem sequer dizer de quem é');

  delete from public.cavalos where id = v_cavalo;
  perform pg_temp.afirmar(
    (select count(*) from public.cavalos where id = v_cavalo) = 0,
    'e apaga o engano que acabou de escrever');
end $$;
reset role;

\echo '== Um cavalo por aprovar não conta para a equipa nem some da vista dela'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000b';
set role authenticated;
do $$
declare v_cavalo uuid;
begin
  -- O instrutor lê tudo, incluindo o que está por decidir: é isso que faz o
  -- cartão do painel existir.
  select id into v_cavalo from public.cavalos where nome = 'Relâmpago';
  perform pg_temp.afirmar(v_cavalo is not null,
    'a equipa vê as fichas dos clientes, aprovadas ou não');

  -- A RLS não encontra a linha para a actualizar: não dá erro, não faz nada.
  perform pg_temp.afirmar_sem_efeito(
    format($q$update public.cavalos set nome = 'Instrutor' where id = %L$q$, v_cavalo),
    'mas corrigir o cavalo de outra pessoa continua a ser só da gestão');
end $$;
reset role;

\echo '== Testes de aprovação de cavalos: todos passaram'
