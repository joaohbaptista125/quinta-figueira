-- =============================================================================
-- O perfil de tratador: lê tudo o que precisa, e não escreve nada
-- =============================================================================
-- Corre depois de 12_paddocks.sql, que já fez o Alberto entrar na aplicação.
--
-- Este ficheiro existe porque a mudança **contraria duas decisões registadas**
-- — o tratador escrevia nos paddocks e nas ferrações, e havia um motivo para
-- isso em cada caso (ver `…_tratador_so_consulta.sql`). Uma regra que
-- contraria outra regressa sozinha ao fim de uns meses se não houver nada a
-- segurá-la. É isto.
--
-- O que se prova:
--
--   * o tratador **lê** o quadro dos paddocks, o calendário e as ferrações;
--   * não escreve em nenhum dos três;
--   * **continua a responder nas notas do cavalo** — é a excepção deliberada,
--     porque não é registo do centro, é a conversa de um cavalo;
--   * o instrutor, que é quem passa a fazer o que ele fazia, consegue mesmo.

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

-- O Alberto já entrou em 12_paddocks.sql; isto é para este ficheiro continuar
-- a correr sozinho se um dia a ordem mudar.
set role postgres;
update public.pessoas
   set email = 'alberto@quintadafigueira.pt'
 where id = '22222222-0000-4000-8000-000000000005'
   and email is distinct from 'alberto@quintadafigueira.pt';
reset role;

insert into auth.users (id, email) values
  ('99999999-0000-4000-8000-00000000000e', 'alberto@quintadafigueira.pt')
on conflict (id) do nothing;

-- Uma ferração do centro para ele tentar mexer, escrita sem sessão.
insert into public.ferracoes (id, cavalo_id, data, tipo)
values ('aaaaaaa1-0000-4000-8000-000000000001',
        '33333333-0000-4000-8000-000000000001', current_date - 10, 'completa');

\echo '== O tratador vê o que precisa de ver'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000e';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(
    (select count(*) from public.paddocks) = 8,
    'vê os oito campos de largada');

  perform pg_temp.afirmar(
    (select count(*) from public.paddock_ocupacao where data = current_date) > 0,
    'e quem está largado hoje — é a pergunta que o quadro responde');

  perform pg_temp.afirmar(
    (select count(*) from public.ferracoes
      where id = 'aaaaaaa1-0000-4000-8000-000000000001') = 1,
    'lê o histórico de ferração, para saber quando o ferrador volta');

  perform pg_temp.afirmar(
    (select count(*) from public.eventos) > 0,
    'e o calendário do centro');
end $$;
reset role;

\echo '== Mas não escreve em nenhum dos três'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000e';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar_recusa(
    format($q$insert into public.paddock_ocupacao (paddock_id, cavalo_id)
              values (%L, '33333333-0000-4000-8000-000000000004')$q$,
           (select id from public.paddocks where numero = 3)),
    'não larga um cavalo');

  perform pg_temp.afirmar_sem_efeito(
    $q$delete from public.paddock_ocupacao where data = current_date$q$,
    'nem recolhe nenhum');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.ferracoes (cavalo_id, data, tipo)
       values ('33333333-0000-4000-8000-000000000001', current_date, 'arranjo')$q$,
    'não regista uma ferração');

  perform pg_temp.afirmar_sem_efeito(
    $q$update public.ferracoes set custo = 999
        where id = 'aaaaaaa1-0000-4000-8000-000000000001'$q$,
    'nem corrige uma que lá esteja');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.eventos (tipo, titulo, data, hora_inicio, hora_fim)
       values ('aula', 'Aula do tratador', current_date, '10:00', '11:00')$q$,
    'não marca nada no calendário');
end $$;
reset role;

\echo '== E continua a responder nas notas do cavalo — a excepção deliberada'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000e';
set role authenticated;
do $$
declare v_nota uuid;
begin
  insert into public.notas_cavalo (cavalo_id, texto)
  values ('33333333-0000-4000-8000-000000000001',
          'Comeu tudo e está bem disposto.')
  returning id into v_nota;

  perform pg_temp.afirmar(
    (select de_equipa from public.notas_cavalo where id = v_nota),
    'a nota fica do lado da cavalariça, como qualquer outra da equipa');
end $$;
reset role;

\echo '== O instrutor faz o que o tratador deixou de fazer'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000b';
set role authenticated;
do $$
declare v_paddock uuid;
begin
  select id into v_paddock from public.paddocks where numero = 3;

  insert into public.paddock_ocupacao (paddock_id, cavalo_id)
  values (v_paddock, '33333333-0000-4000-8000-000000000004');

  perform pg_temp.afirmar(
    exists (select 1 from public.paddock_ocupacao
             where paddock_id = v_paddock
               and cavalo_id = '33333333-0000-4000-8000-000000000004'
               and data = current_date),
    'o instrutor larga um cavalo');

  update public.ferracoes set custo = 45
   where id = 'aaaaaaa1-0000-4000-8000-000000000001';

  perform pg_temp.afirmar(
    (select custo from public.ferracoes
      where id = 'aaaaaaa1-0000-4000-8000-000000000001') = 45,
    'e corrige uma ferração');
end $$;
reset role;

-- Limpeza, para este ficheiro não condicionar os seguintes.
set role postgres;
delete from public.paddock_ocupacao
 where cavalo_id = '33333333-0000-4000-8000-000000000004'
   and data = current_date;
delete from public.ferracoes where id = 'aaaaaaa1-0000-4000-8000-000000000001';
reset role;

\echo '== Testes do perfil de tratador: todos passaram'
