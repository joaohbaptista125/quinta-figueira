-- =============================================================================
-- Os nomes na ficha do evento, e quem compõe uma equipa
-- =============================================================================
-- Corre depois de 01_rls.sql.
--
-- **A armadilha é a mesma da equipa**: `pessoas_ler` é `e_equipa() or id =
-- pessoa_actual_id()` e `cavalos_ler` é `e_equipa()` ou ser dono. Para um
-- cliente convocado, a convocatória vinha com os outros convocados em branco
-- e sem os cavalos deles. `nomes_visiveis()` resolve-o sem abrir ficha
-- nenhuma — e estes testes seguram que não abre mesmo.
--
-- A segunda metade é o pedido do centro: **só a gestão compõe uma equipa**.
-- O instrutor continua a usá-la.

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

-- A aula «Iniciação» já leva a Sónia na Bolota. Juntamos-lhe o Tiago no
-- Vento, que é dele — assim a Sónia tem um colega para não ver.
-- O `reset` do claim é preciso: as triggers de carimbo só se eximem quando
-- `pessoa_actual_id()` é nulo.
reset request.jwt.claim.sub;
set role postgres;
insert into public.evento_participantes (evento_id, pessoa_id, cavalo_id)
values ('77777777-0000-4000-8000-000000000001',
        '22222222-0000-4000-8000-000000000004',
        '33333333-0000-4000-8000-000000000003')
on conflict do nothing;
reset role;

\echo '== O cliente convocado não lê fichas nenhumas'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000c';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(
    (select count(*) from public.pessoas) = 1,
    'a Sónia só lê a própria ficha');

  perform pg_temp.afirmar(
    (select count(*) from public.cavalos
      where id = '33333333-0000-4000-8000-000000000004') = 0,
    'e não lê a Bolota, que é um cavalo de escola sem dono');
end $$;
reset role;

\echo '== Mas vê os nomes de quem e do que está na aula dela'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000c';
set role authenticated;
do $$
declare
  v_pessoas text[];
  v_cavalos text[];
begin
  select array_agg(nome order by nome) into v_pessoas
    from public.nomes_visiveis() where tipo = 'pessoa';

  select array_agg(nome order by nome) into v_cavalos
    from public.nomes_visiveis() where tipo = 'cavalo';

  perform pg_temp.afirmar(
    v_pessoas @> array['Tiago Lourenço'],
    'vê o nome do outro convocado — era isto que vinha em branco');

  perform pg_temp.afirmar(
    v_pessoas @> array['Rui Antunes'],
    'e o de quem dá a aula');

  perform pg_temp.afirmar(
    not (v_pessoas @> array['Maria Figueira']),
    'mas não vê quem não tem nada que ver com esta aula');

  perform pg_temp.afirmar(
    v_cavalos @> array['Bolota'] and v_cavalos @> array['Vento'],
    'e vê os cavalos do quadro, incluindo o que não consegue ler na ficha');
end $$;
reset role;

\echo '== E o que não é dela continua fechado'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000c';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(
    (select count(*) from public.nomes_visiveis()
      where tipo = 'pessoa' and nome = 'Alberto Nunes') = 0,
    'não vê o tratador, com quem não partilha equipa nem evento');

  -- O Trovão é do Tiago e anda no treino de Horseball, onde ela não está.
  perform pg_temp.afirmar(
    (select count(*) from public.nomes_visiveis()
      where tipo = 'cavalo' and nome = 'Trovão') = 0,
    'nem um cavalo que só aparece num evento onde ela não está');
end $$;
reset role;

\echo '== E para quem é da casa devolve tudo, senão as páginas dela ficavam vazias'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000a';
set role authenticated;
do $$
begin
  -- Isto não abre nada: `pessoas_ler` e `cavalos_ler` já lhe dão tudo. O que
  -- importa é que a função não seja mais restritiva do que a RLS — senão as
  -- listagens da gestão, que agora tiram os nomes daqui, apareciam com
  -- «Sem nome» em cada linha.
  perform pg_temp.afirmar(
    (select count(*) from public.nomes_visiveis() where tipo = 'pessoa')
      = (select count(*) from public.pessoas),
    'a gestão vê o nome de toda a gente');

  perform pg_temp.afirmar(
    (select count(*) from public.nomes_visiveis() where tipo = 'cavalo')
      = (select count(*) from public.cavalos),
    'e o de todos os cavalos');
end $$;
reset role;

\echo '== Compor uma equipa é da gestão, e já não do instrutor'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000b';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar_recusa(
    $q$insert into public.equipa_membros (equipa_id, pessoa_id)
       values ('66666666-0000-4000-8000-000000000001',
               '22222222-0000-4000-8000-000000000003')$q$,
    'o instrutor não acrescenta ninguém a uma equipa');

  perform pg_temp.afirmar_sem_efeito(
    $q$delete from public.equipa_membros
        where equipa_id = '66666666-0000-4000-8000-000000000001'$q$,
    'nem tira');

  perform pg_temp.afirmar_sem_efeito(
    $q$update public.equipas set nome = 'Outro nome'
        where id = '66666666-0000-4000-8000-000000000001'$q$,
    'nem muda a equipa — o formulário é a lista de membros');

  perform pg_temp.afirmar(
    (select count(*) from public.equipa_membros
      where equipa_id = '66666666-0000-4000-8000-000000000001') = 1,
    'mas continua a ver quem lá está, que é do que precisa para planear');
end $$;
reset role;

\echo '== O que o instrutor continua a poder fazer com a equipa'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000b';
set role authenticated;
do $$
begin
  -- Convocar a equipa inteira para um treino é dele; a composição é que não.
  insert into public.evento_participantes (evento_id, pessoa_id)
  values ('77777777-0000-4000-8000-000000000002',
          '22222222-0000-4000-8000-000000000003');

  perform pg_temp.afirmar(
    (select count(*) from public.evento_participantes
      where evento_id = '77777777-0000-4000-8000-000000000002') = 2,
    'convoca quem quiser para um evento — isso não mudou');
end $$;
reset role;

\echo '== E a gestão compõe'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000a';
set role authenticated;
do $$
begin
  insert into public.equipa_membros (equipa_id, pessoa_id)
  values ('66666666-0000-4000-8000-000000000001',
          '22222222-0000-4000-8000-000000000003');

  perform pg_temp.afirmar(
    (select count(*) from public.equipa_membros
      where equipa_id = '66666666-0000-4000-8000-000000000001') = 2,
    'a gestão acrescenta um membro');

  delete from public.equipa_membros
   where equipa_id = '66666666-0000-4000-8000-000000000001'
     and pessoa_id = '22222222-0000-4000-8000-000000000003';

  perform pg_temp.afirmar(
    (select count(*) from public.equipa_membros
      where equipa_id = '66666666-0000-4000-8000-000000000001') = 1,
    'e tira');
end $$;
reset role;

\echo '== Testes dos nomes do evento e dos membros: todos passaram'
