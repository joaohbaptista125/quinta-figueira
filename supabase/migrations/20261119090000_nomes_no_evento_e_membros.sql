-- =============================================================================
-- 1. Os nomes na ficha do evento     2. Os membros da equipa são da gestão
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. A mesma armadilha da equipa, agora no evento
-- -----------------------------------------------------------------------------
-- Ficou assinalada quando se resolveu a da equipa, e é igual: `pessoas_ler` é
-- `e_equipa() or id = pessoa_actual_id()`, por isso **um cliente convocado não
-- via os nomes dos outros convocados** — a convocatória aparecia-lhe como uma
-- lista de linhas em branco. E `cavalos_ler` é `e_equipa()` ou ser dono, por
-- isso os pares aluno↔cavalo dos outros também vinham sem nome.
--
-- A saída é a de `nomes_da_equipa()`: SECURITY DEFINER a devolver **só id e
-- nome**, e só a quem tem que ver com aquele evento. Abrir `pessoas` dava ao
-- cliente a ficha inteira dos colegas, e a RLS decide linhas e não colunas.
--
-- Devolve pessoas **e** cavalos na mesma chamada, com uma coluna a dizer qual
-- é qual: são as duas listas que o ecrã precisa, e duas funções eram duas
-- idas à rede por cada abertura de um evento.

create or replace function public.nomes_do_evento(p_evento uuid)
returns table (tipo text, id uuid, nome text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- A guarda. Sem isto, SECURITY DEFINER era um buraco: qualquer pessoa
  -- autenticada pedia os nomes de qualquer evento.
  with permitido as (
    select public.e_equipa() or public.participo_no_evento(p_evento) as sim
  )
  select 'pessoa'::text, p.id, p.nome
    from public.pessoas p, permitido
   where permitido.sim
     and (
       exists (
         select 1 from public.evento_participantes ep
          where ep.evento_id = p_evento and ep.pessoa_id = p.id
       )
       or exists (
         select 1 from public.avisos a
          where a.evento_id = p_evento and a.autor_id = p.id
       )
       or exists (
         select 1 from public.eventos e
          where e.id = p_evento and e.responsavel_id = p.id
       )
     )

  union all

  select 'cavalo'::text, c.id, c.nome
    from public.cavalos c, permitido
   where permitido.sim
     and exists (
       select 1 from public.evento_participantes ep
        where ep.evento_id = p_evento and ep.cavalo_id = c.id
     );
$$;

comment on function public.nomes_do_evento(uuid) is
  'Id e nome de quem e do que aparece na ficha de um evento — convocados, responsável, quem escreveu um aviso, e os cavalos atribuídos. SECURITY DEFINER para o cliente convocado ver os outros convocados sem lhe abrir as fichas deles.';

revoke all on function public.nomes_do_evento(uuid) from public;
grant execute on function public.nomes_do_evento(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Quem entra e sai de uma equipa é decisão da gestão
-- -----------------------------------------------------------------------------
-- Pedido do centro: **só o administrador e o gestor** acrescentam ou tiram
-- membros. O instrutor continua a ver quem está na equipa — precisa disso para
-- planear — mas sem as caixas de visto à frente.
--
-- Vai junto a edição da própria equipa (nome, escalão, activa) e apagá-la, e
-- não por preguiça: o formulário **é** a lista de membros. Um instrutor que
-- pudesse gravar o nome da equipa com as caixas escondidas gravava uma
-- convocatória vazia — `sincronizarMembros` lê o que vem no formulário, e o
-- que não vem é para apagar. Meio formulário era mais perigoso do que nenhum.
--
-- **O que não muda:** o instrutor continua a marcar treinos, a convocar a
-- equipa inteira para um evento (`evento_participantes` é
-- `e_instrutor_ou_gestao()`) e a moderar o chat (`avisos_gerir`, idem). O que
-- lhe sai das mãos é a composição da equipa, não o uso dela.

drop policy equipas_gerir on public.equipas;

create policy equipas_gerir on public.equipas
  for all to authenticated
  using (public.e_gestao())
  with check (public.e_gestao());

drop policy equipa_membros_gerir on public.equipa_membros;

create policy equipa_membros_gerir on public.equipa_membros
  for all to authenticated
  using (public.e_gestao())
  with check (public.e_gestao());
