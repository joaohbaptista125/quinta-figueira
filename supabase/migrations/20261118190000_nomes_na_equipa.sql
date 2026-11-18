-- =============================================================================
-- Quem está numa equipa vê o nome de quem lá está com ele
-- =============================================================================
-- **O Chat estava partido para quem o ia usar, e não se via a testar como
-- gestão.** `pessoas_ler` é `e_equipa() or id = pessoa_actual_id()`, e um
-- jogador de Horseball é um `cliente`. Do lado dele:
--
--   * a lista de jogadores da equipa aparecia **em branco** — a RLS filtrava
--     o `pessoas(nome)` embebido em `equipa_membros`;
--   * todas as mensagens dos outros apareciam como «Quinta da Figueira»,
--     porque o autor não vinha;
--   * e os nomes de quem reagiu apareciam como «Alguém».
--
-- **A saída não é abrir `pessoas` à equipa toda.** Isso dava ao cliente a
-- ficha inteira dos colegas — email, telefone, perfil — e a RLS decide linhas,
-- não colunas, por isso não havia meio-termo pelo `select`. É a armadilha de
-- sempre, a mesma que levou o NIF e a morada para `pessoas_reservado`.
--
-- O que se faz é o que `agenda_por_token()` já faz: uma função SECURITY
-- DEFINER que devolve **só o que é preciso** — id e nome — e só a quem tem
-- que ver com aquela equipa. Não há coluna nenhuma a mais para escapar.
--
-- Devolve três grupos de pessoas, que são exactamente as que aparecem no ecrã
-- de uma equipa: os **membros**, quem **escreveu** no chat (um instrutor pode
-- escrever sem ser membro) e quem **reagiu** a uma mensagem.

create or replace function public.nomes_da_equipa(p_equipa uuid)
returns table (id uuid, nome text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.nome
    from public.pessoas p
   -- A guarda. Sem isto, SECURITY DEFINER era um buraco: qualquer pessoa
   -- autenticada pedia os nomes de qualquer equipa.
   where (public.e_equipa() or public.sou_membro_da_equipa(p_equipa))
     and (
       exists (
         select 1 from public.equipa_membros em
          where em.equipa_id = p_equipa and em.pessoa_id = p.id
       )
       or exists (
         select 1 from public.avisos a
          where a.equipa_id = p_equipa and a.autor_id = p.id
       )
       or exists (
         select 1
           from public.aviso_reaccoes r
           join public.avisos a on a.id = r.aviso_id
          where a.equipa_id = p_equipa and r.pessoa_id = p.id
       )
     );
$$;

comment on function public.nomes_da_equipa(uuid) is
  'Id e nome de quem aparece no ecrã de uma equipa — membros, quem escreveu no chat e quem reagiu. SECURITY DEFINER para o cliente poder ver os colegas sem lhe abrir a ficha deles.';

revoke all on function public.nomes_da_equipa(uuid) from public;
grant execute on function public.nomes_da_equipa(uuid) to authenticated;
