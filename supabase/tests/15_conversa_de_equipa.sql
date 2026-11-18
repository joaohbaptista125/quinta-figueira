-- =============================================================================
-- A conversa da equipa: quem escreve, quem não escreve, e quem apaga
-- =============================================================================
-- Corre depois de 01_rls.sql, que já criou as contas de acesso.
--
-- Abrir a escrita a quem não é da gestão foi a primeira vez que isso aconteceu
-- fora das notas do cavalo. O que estes testes seguram é a fronteira: a
-- conversa é **da equipa**, não é um sítio para escrever em qualquer lado.

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

-- O Tiago é da Sub-16; a Sónia é da Sénior. Nenhum é da gestão.
\echo '== Um membro escreve na conversa da sua equipa'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000d';
set role authenticated;
do $$
declare v_aviso uuid;
begin
  insert into public.avisos (equipa_id, texto)
  values ('66666666-0000-4000-8000-000000000001', 'Levo as bolas eu.')
  returning id into v_aviso;

  perform pg_temp.afirmar(
    (select autor_id from public.avisos where id = v_aviso)
      = public.pessoa_actual_id(),
    'o autor é carimbado pela base, e é mesmo quem escreveu');

  -- Mesmo mentindo no INSERT.
  insert into public.avisos (equipa_id, texto, autor_id)
  values ('66666666-0000-4000-8000-000000000001', 'Não fui eu.',
          '22222222-0000-4000-8000-000000000001');

  perform pg_temp.afirmar(
    (select autor_id from public.avisos where texto = 'Não fui eu.')
      = public.pessoa_actual_id(),
    'e não se escreve em nome de outra pessoa');
end $$;
reset role;

\echo '== Mas só na dele, e só na equipa'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000d';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar_recusa(
    $q$insert into public.avisos (equipa_id, texto)
       values ('66666666-0000-4000-8000-000000000002', 'Intruso')$q$,
    'não escreve na conversa de uma equipa onde não está');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.avisos (evento_id, texto)
       values ('77777777-0000-4000-8000-000000000003', 'Aula cancelada')$q$,
    'nem publica avisos num evento — isso é de quem planeia');
end $$;
reset role;

\echo '== Ninguém reescreve o que já foi dito'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000d';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar_sem_efeito(
    $q$delete from public.avisos where texto = 'Levo as bolas eu.'$q$,
    'nem o próprio autor apaga a sua mensagem');

  perform pg_temp.afirmar_sem_efeito(
    $q$update public.avisos set texto = 'Afinal não levo'
        where texto = 'Levo as bolas eu.'$q$,
    'nem a corrige depois do facto');
end $$;
reset role;

\echo '== A gestão apaga, para o caso de alguém escrever o que não devia'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000a';
set role authenticated;
do $$
begin
  delete from public.avisos where texto = 'Não fui eu.';
  perform pg_temp.afirmar(
    (select count(*) from public.avisos where texto = 'Não fui eu.') = 0,
    'a gestão apaga uma mensagem');
end $$;
reset role;

\echo '== E quem não é da equipa nem a lê'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000c';
set role authenticated;
do $$
begin
  -- A Sónia é da Sénior, não da Sub-16.
  perform pg_temp.afirmar(
    (select count(*) from public.avisos
      where equipa_id = '66666666-0000-4000-8000-000000000001') = 0,
    'a conversa de uma equipa não se lê de fora');
end $$;
reset role;

\echo '== Testes da conversa de equipa: todos passaram'
