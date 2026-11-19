-- =============================================================================
-- Uma função só: os nomes que eu posso ver
-- =============================================================================
-- Substitui `nomes_da_equipa()` e `nomes_do_evento()`, que eram duas respostas
-- à mesma pergunta — e a terceira estava a caminho.
--
-- **O problema de origem**, que continua de pé e é o que isto contorna:
-- `pessoas_ler` é `e_equipa() or id = pessoa_actual_id()` e `cavalos_ler` é
-- `e_equipa()` ou ser dono. Para um cliente, isso quer dizer que **nada do que
-- é dos outros tem nome**: a lista de jogadores da equipa vinha em branco, as
-- mensagens do chat sem autor, a convocatória sem colegas, e o quadro do dia
-- sem os pares aluno↔cavalo. Abrir `pessoas` resolvia tudo e abria a ficha
-- inteira dos colegas — email, telefone, perfil —, porque a RLS decide linhas
-- e não colunas.
--
-- **Porque é que isto é uma função sem argumentos.** As duas anteriores
-- recebiam a equipa ou o evento, e isso funciona enquanto o ecrã mostra **um**
-- deles. O quadro do dia mostra os eventos todos de um dia: uma função por
-- evento seriam N idas à rede para abrir uma página. A pergunta certa não é
-- «quem está neste evento» mas **«de quem é que eu posso ver o nome»** — e
-- essa responde-se uma vez por página, independentemente do que lá esteja.
--
-- O preço é devolver mais linhas do que o ecrã usa. Num centro com ~80 pessoas
-- e ~60 cavalos isso são uns kilobytes, e a alternativa era passar listas de
-- ids da aplicação para a base — mais código em três sítios para poupar o que
-- não custa. **Se um dia isto crescer uma ordem de grandeza, é aqui que se
-- volta a pensar**, e aí a saída é parametrizar por dia ou por evento.
--
-- Devolve **pessoas e cavalos** com uma coluna a dizer qual é qual: são as
-- duas listas de que os ecrãs precisam, e separá-las eram duas idas à rede.
--
-- **A fronteira é partilhar alguma coisa comigo.** Quem é da casa (`e_equipa()`)
-- já lê tudo pela RLS, por isso para esses a função devolve tudo e não faz
-- contas. Para os outros, o nome só aparece se partilharmos uma equipa ou um
-- evento — e é só o **nome**, nunca mais nada.

create or replace function public.nomes_visiveis()
returns table (tipo text, id uuid, nome text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with eu as (
    select public.pessoa_actual_id() as id, public.e_equipa() as da_casa
  )
  select 'pessoa'::text, p.id, p.nome
    from public.pessoas p, eu
   -- Sem sessão não há nada a ver. A guarda vale por todas: é ela que impede
   -- SECURITY DEFINER de ser um buraco.
   where eu.id is not null
     and (
       eu.da_casa
       or p.id = eu.id

       -- Quem está numa equipa minha.
       or exists (
         select 1
           from public.equipa_membros meu
           join public.equipa_membros dele on dele.equipa_id = meu.equipa_id
          where meu.pessoa_id = eu.id and dele.pessoa_id = p.id
       )

       -- Quem escreveu no chat de uma equipa minha — um instrutor escreve lá
       -- sem ser membro.
       or exists (
         select 1
           from public.avisos a
           join public.equipa_membros meu on meu.equipa_id = a.equipa_id
          where meu.pessoa_id = eu.id and a.autor_id = p.id
       )

       -- E quem reagiu a uma dessas mensagens, senão a reacção dizia «Alguém».
       or exists (
         select 1
           from public.aviso_reaccoes r
           join public.avisos a on a.id = r.aviso_id
           join public.equipa_membros meu on meu.equipa_id = a.equipa_id
          where meu.pessoa_id = eu.id and r.pessoa_id = p.id
       )

       -- Quem foi convocado para um evento em que eu também estou.
       or exists (
         select 1
           from public.evento_participantes meu
           join public.evento_participantes dele
             on dele.evento_id = meu.evento_id
          where meu.pessoa_id = eu.id and dele.pessoa_id = p.id
       )

       -- Quem dá esse evento.
       or exists (
         select 1
           from public.eventos e
           join public.evento_participantes meu on meu.evento_id = e.id
          where meu.pessoa_id = eu.id and e.responsavel_id = p.id
       )

       -- E quem lá publicou um aviso.
       or exists (
         select 1
           from public.avisos a
           join public.evento_participantes meu on meu.evento_id = a.evento_id
          where meu.pessoa_id = eu.id and a.autor_id = p.id
       )
     )

  union all

  select 'cavalo'::text, c.id, c.nome
    from public.cavalos c, eu
   where eu.id is not null
     and (
       eu.da_casa
       or c.proprietario_id = eu.id

       -- Os cavalos do quadro: quem monta o quê num evento em que eu estou.
       -- Sem isto, um cavalo de escola — que não tem dono — não tinha nome
       -- para ninguém de fora da casa, nem sequer para quem o montava.
       or exists (
         select 1
           from public.evento_participantes dele
           join public.evento_participantes meu
             on meu.evento_id = dele.evento_id
          where meu.pessoa_id = eu.id and dele.cavalo_id = c.id
       )
     );
$$;

comment on function public.nomes_visiveis() is
  'Id e nome de todas as pessoas e cavalos de quem quem consulta pode ver o nome — por partilhar uma equipa ou um evento, ou por ser da casa. SECURITY DEFINER, e devolve só o nome.';

revoke all on function public.nomes_visiveis() from public;
grant execute on function public.nomes_visiveis() to authenticated;

-- As duas de ontem saem: eram a mesma pergunta feita duas vezes.
drop function public.nomes_da_equipa(uuid);
drop function public.nomes_do_evento(uuid);
