-- =============================================================================
-- Quem entra, e quem pode fazer administradores
-- =============================================================================
-- Corre depois de 01_rls.sql, que já criou as contas de acesso.
--
-- Os dois lados que aqui se provam apareceram do mesmo sítio: uma pessoa com
-- ficha de gestor que continuava a ver «conta sem acesso».

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

\echo '== A conta criada antes da ficha liga-se à mesma'
set role postgres;
do $$
declare v_pessoa uuid;
begin
  -- É esta a ordem que estava partida: primeiro a conta, só depois a ficha.
  insert into auth.users (id, email)
  values ('99999999-0000-4000-8000-0000000000e1', 'tardia@exemplo.pt');

  perform pg_temp.afirmar(
    (select count(*) from public.pessoas where email = 'tardia@exemplo.pt') = 0,
    'a conta existe e não há ficha nenhuma para ela');

  insert into public.pessoas (nome, email, perfil)
  values ('Tardia', 'tardia@exemplo.pt', 'gestor')
  returning id into v_pessoa;

  perform pg_temp.afirmar(
    (select auth_user_id from public.pessoas where id = v_pessoa)
      = '99999999-0000-4000-8000-0000000000e1',
    'escrever a ficha depois liga-a à conta que já existia');

  perform pg_temp.afirmar(
    (select perfil from public.pessoas where id = v_pessoa) = 'gestor',
    'e não lhe estraga o perfil que a gestão escolheu');
end $$;
reset role;

\echo '== As maiúsculas não contam, e um espaço do outro lado também não'
set role postgres;
do $$
declare v_pessoa uuid;
begin
  -- O espaço vai no lado da conta: em `pessoas` a restrição do email já o
  -- recusa, mas `auth.users` é tabela do Supabase e não dá essa garantia.
  insert into auth.users (id, email)
  values ('99999999-0000-4000-8000-0000000000e2', ' espaco@exemplo.pt ');

  insert into public.pessoas (nome, email)
  values ('Espaço', 'Espaco@Exemplo.PT')
  returning id into v_pessoa;

  perform pg_temp.afirmar(
    (select auth_user_id from public.pessoas where id = v_pessoa)
      = '99999999-0000-4000-8000-0000000000e2',
    'maiúsculas na ficha e espaços na conta não impedem a ligação');

  perform pg_temp.afirmar(
    (select perfil from public.pessoas where id = v_pessoa) = 'cliente',
    'uma ficha sem perfil que ganha conta nasce cliente');
end $$;
reset role;

\echo '== Corrigir o email trocado também liga'
set role postgres;
do $$
declare v_pessoa uuid;
begin
  insert into auth.users (id, email)
  values ('99999999-0000-4000-8000-0000000000e3', 'certo@exemplo.pt');

  insert into public.pessoas (nome, email) values ('Engano', 'errado@exemplo.pt')
  returning id into v_pessoa;

  perform pg_temp.afirmar(
    (select auth_user_id is null from public.pessoas where id = v_pessoa),
    'com o email trocado não liga a nada — e ainda bem');

  update public.pessoas set email = 'certo@exemplo.pt' where id = v_pessoa;

  perform pg_temp.afirmar(
    (select auth_user_id from public.pessoas where id = v_pessoa)
      = '99999999-0000-4000-8000-0000000000e3',
    'corrigir o email liga a ficha à conta');
end $$;
reset role;

\echo '== Uma conta já presa a uma ficha não se rouba'
set role postgres;
do $$
declare
  v_primeira uuid;
  v_segunda  uuid;
begin
  -- O caso real: a ficha A apanha a conta, depois mudam-lhe o email, e uma
  -- ficha B nasce com o endereço antigo. B encontra a conta — e não a leva.
  -- Sem esta guarda era um 23505 em cima de `auth_user_id`, que é único.
  insert into auth.users (id, email)
  values ('99999999-0000-4000-8000-0000000000e4', 'mudou@exemplo.pt');

  insert into public.pessoas (nome, email) values ('Primeira', 'mudou@exemplo.pt')
  returning id into v_primeira;

  perform pg_temp.afirmar(
    (select auth_user_id from public.pessoas where id = v_primeira)
      = '99999999-0000-4000-8000-0000000000e4',
    'a primeira ficha apanha a conta');

  update public.pessoas set email = 'outro@exemplo.pt' where id = v_primeira;

  insert into public.pessoas (nome, email) values ('Segunda', 'mudou@exemplo.pt')
  returning id into v_segunda;

  perform pg_temp.afirmar(
    (select auth_user_id is null from public.pessoas where id = v_segunda),
    'a segunda fica sem conta — e a gravação não rebenta');

  perform pg_temp.afirmar(
    (select auth_user_id from public.pessoas where id = v_primeira)
      = '99999999-0000-4000-8000-0000000000e4',
    'e a primeira continua com a dela');

  delete from public.pessoas where id in (v_primeira, v_segunda);
end $$;
reset role;

\echo '== Um gestor não se promove a administrador'
set request.jwt.claim.sub = '99999999-0000-4000-8000-0000000000e1';
set role authenticated;
do $$
declare v_eu uuid;
begin
  v_eu := public.pessoa_actual_id();
  perform pg_temp.afirmar(v_eu is not null, 'a gestora tardia entra mesmo');
  perform pg_temp.afirmar(public.e_gestao(), 'e é gestão');
  perform pg_temp.afirmar(not public.e_admin(), 'mas não é administradora');

  perform pg_temp.afirmar_recusa(
    format($q$update public.pessoas set perfil = 'admin' where id = %L$q$, v_eu),
    'um gestor não se põe a si próprio a administrador');

  perform pg_temp.afirmar_recusa(
    $q$update public.pessoas set perfil = 'cliente'
        where email = 'maria@quintadafigueira.pt'$q$,
    'nem tira o perfil ao administrador');

  perform pg_temp.afirmar_recusa(
    $q$update public.pessoas set activo = false
        where email = 'maria@quintadafigueira.pt'$q$,
    'nem o desactiva pelas costas');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.pessoas (nome, email, perfil)
       values ('Atalho', 'atalho@exemplo.pt', 'admin')$q$,
    'nem cria uma ficha nova já com perfil de administrador');

  perform pg_temp.afirmar_recusa(
    $q$delete from public.pessoas where email = 'maria@quintadafigueira.pt'$q$,
    'nem apaga a ficha do administrador activo');
end $$;
reset role;

\echo '== Mas continua a tratar dos outros perfis, que é o trabalho dele'
set request.jwt.claim.sub = '99999999-0000-4000-8000-0000000000e1';
set role authenticated;
do $$
begin
  update public.pessoas set perfil = 'instrutor' where email = 'sonia@exemplo.pt';
  perform pg_temp.afirmar(
    (select perfil from public.pessoas where email = 'sonia@exemplo.pt') = 'instrutor',
    'um gestor põe um cliente a instrutor');

  update public.pessoas set perfil = 'cliente' where email = 'sonia@exemplo.pt';
  perform pg_temp.afirmar(
    (select perfil from public.pessoas where email = 'sonia@exemplo.pt') = 'cliente',
    'e volta a pô-lo como estava');
end $$;
reset role;

\echo '== O administrador dá o perfil, mas o último não se tira'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000a';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(public.e_admin(), 'a Maria é administradora');

  perform pg_temp.afirmar_recusa(
    $q$update public.pessoas set perfil = 'gestor'
        where email = 'maria@quintadafigueira.pt'$q$,
    'nem o próprio administrador se tira a si, sendo o único');

  -- Com um segundo administrador, já se pode largar o primeiro.
  update public.pessoas set perfil = 'admin' where email = 'tardia@exemplo.pt';
  perform pg_temp.afirmar(
    (select perfil from public.pessoas where email = 'tardia@exemplo.pt') = 'admin',
    'o administrador promove outro administrador');

  update public.pessoas set perfil = 'gestor'
   where email = 'maria@quintadafigueira.pt';
  perform pg_temp.afirmar(
    (select perfil from public.pessoas where email = 'maria@quintadafigueira.pt')
      = 'gestor',
    'e aí já se pode largar — porque ficou outro');

  -- E a partir daqui já não volta atrás sozinha: é precisamente disto que
  -- se trata. Quem a repõe é o outro administrador, lá em baixo.
  perform pg_temp.afirmar(not public.e_admin(),
    'quem se largou deixou de ser administrador no mesmo instante');
  perform pg_temp.afirmar_recusa(
    $q$update public.pessoas set perfil = 'admin'
        where email = 'maria@quintadafigueira.pt'$q$,
    'e já não se repõe a si própria');
end $$;
reset role;

\echo '== E o administrador novo devolve o perfil ao antigo'
set request.jwt.claim.sub = '99999999-0000-4000-8000-0000000000e1';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(public.e_admin(), 'a tardia é agora administradora');

  update public.pessoas set perfil = 'admin'
   where email = 'maria@quintadafigueira.pt';
  perform pg_temp.afirmar(
    (select perfil from public.pessoas where email = 'maria@quintadafigueira.pt')
      = 'admin',
    'devolve o perfil a quem o largou');

  -- Deixa tudo como estava, para os testes seguintes.
  update public.pessoas set perfil = 'gestor' where email = 'tardia@exemplo.pt';
end $$;
reset role;

\echo '== O NIF, a morada e as notas não se lêem de fora da gestão'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000b';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(public.e_equipa() and not public.e_gestao(),
    'o Rui é instrutor: equipa, mas não gestão');

  perform pg_temp.afirmar(
    (select count(*) from public.pessoas) >= 5,
    'continua a ver as fichas todas, que é o que precisa');

  -- É isto que a mudança de tabela comprou. Enquanto estas colunas viviam em
  -- `pessoas`, vinham no mesmo pedido que o nome.
  perform pg_temp.afirmar(
    (select count(*) from public.pessoas_reservado
      where pessoa_id <> public.pessoa_actual_id()) = 0,
    'mas não lê o NIF, a morada nem as notas de mais ninguém');

  perform pg_temp.afirmar_recusa(
    $q$insert into public.pessoas_reservado (pessoa_id, nif)
       values ('22222222-0000-4000-8000-000000000003', '123456789')$q$,
    'nem escreve lá');
end $$;
reset role;

\echo '== Cada um vê o que é seu, e a gestão vê tudo'
set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000c';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(
    (select nif from public.pessoas_reservado
      where pessoa_id = public.pessoa_actual_id()) = '210000003',
    'a cliente lê o seu próprio NIF');

  perform pg_temp.afirmar(
    (select count(*) from public.pessoas_reservado) = 1,
    'e só o seu');
end $$;
reset role;

set request.jwt.claim.sub = '99999999-0000-4000-8000-00000000000a';
set role authenticated;
do $$
begin
  perform pg_temp.afirmar(
    (select count(*) from public.pessoas_reservado) >= 4,
    'a gestão lê os de toda a gente');

  update public.pessoas_reservado set morada = 'Rua do Picadeiro, 1'
   where pessoa_id = '22222222-0000-4000-8000-000000000003';
  perform pg_temp.afirmar(
    (select morada from public.pessoas_reservado
      where pessoa_id = '22222222-0000-4000-8000-000000000003')
      = 'Rua do Picadeiro, 1',
    'e escreve-os');
end $$;
reset role;

\echo '== Apagar a pessoa leva os dados reservados consigo'
set role postgres;
do $$
declare v_pessoa uuid;
begin
  insert into public.pessoas (nome) values ('Passageiro') returning id into v_pessoa;
  insert into public.pessoas_reservado (pessoa_id, nif) values (v_pessoa, '999999999');

  delete from public.pessoas where id = v_pessoa;
  perform pg_temp.afirmar(
    (select count(*) from public.pessoas_reservado where pessoa_id = v_pessoa) = 0,
    'não fica um NIF órfão para trás (cascade)');
end $$;
reset role;

\echo '== Testes de acesso e perfis: todos passaram'
