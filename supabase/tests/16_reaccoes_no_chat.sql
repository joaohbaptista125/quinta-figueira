-- =============================================================================
-- Reagir a uma mensagem: quem reage, a quê, e o que se pode desfazer
-- =============================================================================
-- Corre depois de 01_rls.sql (contas de acesso) e de 15 (a conversa).
--
-- Uma reacção é o gesto mais barato da aplicação, e por isso é o mais fácil de
-- deixar aberto por engano. O que estes testes seguram:
--
--   * a fronteira é a da própria mensagem — quem não a lê não lhe reage;
--   * quem reagiu é a base que diz, não quem envia o pedido;
--   * a reacção tira-se, mas **só a própria** — nem a gestão tira a de outro;
--   * a mesma pessoa não reage duas vezes com o mesmo emoji.

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

-- Duas mensagens, uma em cada equipa, escritas sem sessão (como o seed).
insert into public.avisos (id, equipa_id, texto) values
  ('88888888-0000-4000-8000-000000000001',
   '66666666-0000-4000-8000-000000000001', 'Treino antecipado para as 18h.'),
  ('88888888-0000-4000-8000-000000000002',
   '66666666-0000-4000-8000-000000000002', 'Levamos os equipamentos novos.');

-- O Tiago é da Sub-16 (equipa 1); a Sónia é da Sénior (equipa 2).
\echo '== Um membro reage a uma mensagem da sua equipa'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000d';
set role authenticated;
do $$
begin
  -- E mente no `pessoa_id`, para se ver que não serve de nada.
  insert into public.aviso_reaccoes (aviso_id, pessoa_id, emoji)
  values ('88888888-0000-4000-8000-000000000001',
          '22222222-0000-4000-8000-000000000001', '👍');

  perform pg_temp.afirmar(
    (select pessoa_id from public.aviso_reaccoes
      where aviso_id = '88888888-0000-4000-8000-000000000001')
      = public.pessoa_actual_id(),
    'quem reagiu é carimbado pela base, e não por quem envia o pedido');
end $$;
reset role;

\echo '== A mesma pessoa não reage duas vezes com o mesmo emoji'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000d';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar_recusa(
    $q$insert into public.aviso_reaccoes (aviso_id, emoji)
       values ('88888888-0000-4000-8000-000000000001', '👍')$q$,
    'a chave primária trava a reacção repetida — é o que torna o botão um interruptor');
end $$;
reset role;

\echo '== Mas reage com outro, e isso são duas reacções'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000d';
set role authenticated;
do $$
begin
  insert into public.aviso_reaccoes (aviso_id, emoji)
  values ('88888888-0000-4000-8000-000000000001', '🎉');

  perform pg_temp.afirmar(
    (select count(*) from public.aviso_reaccoes
      where aviso_id = '88888888-0000-4000-8000-000000000001') = 2,
    'a mesma pessoa reage com emojis diferentes');
end $$;
reset role;

\echo '== A fronteira é a da mensagem: fora da equipa não se lê nem se reage'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000c';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(
    (select count(*) from public.aviso_reaccoes
      where aviso_id = '88888888-0000-4000-8000-000000000001') = 0,
    'a Sónia não vê as reacções de uma conversa onde não está');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.aviso_reaccoes (aviso_id, emoji)
       values ('88888888-0000-4000-8000-000000000001', '👏')$q$,
    'nem lhe reage — a política segue a RLS de `avisos`, sem a repetir');

  -- Na dela, reage.
  insert into public.aviso_reaccoes (aviso_id, emoji)
  values ('88888888-0000-4000-8000-000000000002', '❤️');

  perform pg_temp.afirmar(
    (select count(*) from public.aviso_reaccoes
      where aviso_id = '88888888-0000-4000-8000-000000000002') = 1,
    'e na conversa da equipa dela reage à vontade');
end $$;
reset role;

\echo '== A reacção tira-se, ao contrário da mensagem'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000d';
set role authenticated;
do $$
begin
  delete from public.aviso_reaccoes
   where aviso_id = '88888888-0000-4000-8000-000000000001' and emoji = '🎉';

  perform pg_temp.afirmar(
    (select count(*) from public.aviso_reaccoes
      where aviso_id = '88888888-0000-4000-8000-000000000001') = 1,
    'quem reagiu desfaz — é um interruptor, não um registo');
end $$;
reset role;

\echo '== Mas só a sua, e nem a gestão tira a de outra pessoa'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000a';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar_sem_efeito(
    $q$delete from public.aviso_reaccoes
        where aviso_id = '88888888-0000-4000-8000-000000000001'$q$,
    'apagar a reacção de outra pessoa é falar em nome dela');
end $$;
reset role;

\echo '== Apagar a mensagem leva as reacções com ela'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000a';
set role authenticated;
do $$
begin
  delete from public.avisos where id = '88888888-0000-4000-8000-000000000001';

  perform pg_temp.afirmar(
    (select count(*) from public.aviso_reaccoes
      where aviso_id = '88888888-0000-4000-8000-000000000001') = 0,
    'o `on delete cascade` é o que faz a gestão não precisar de apagar reacções uma a uma');
end $$;
reset role;

\echo '== Testes das reacções: todos passaram'
