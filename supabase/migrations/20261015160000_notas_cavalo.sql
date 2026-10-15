-- =============================================================================
-- Notas e pedidos: uma conversa por cavalo
-- =============================================================================
-- Isto parece um chat e não é, e a diferença importa. Um chat geral nesta
-- aplicação morreria — foi a razão de na Fase 3 haver avisos e não conversa —
-- porque sem notificações fiáveis ninguém volta lá, e as conversas continuam
-- no WhatsApp.
--
-- Uma conversa **presa a um cavalo** é outra coisa: é um caderno. «O Fidalgo
-- veio a coxear de segunda.» «Pode ficar sem ferraduras atrás?» «O microchip
-- da ficha está trocado.» Pouco volume, nada urgente, e o valor é ficar
-- agarrado ao cavalo — daqui a um ano lê-se o que se passou com ele.
--
-- É também o que responde ao cliente que quer corrigir dados do cavalo: ele
-- escreve, a gestão lê e corrige à mão. Uma fila de propostas com estado
-- resolveria o mesmo e traria uma notificação que a aplicação não sabe dar.
--
-- O que faz isto funcionar não é a notificação: é a gestão ver, no painel e na
-- listagem, quantos cavalos têm a última palavra do lado do cliente.

create table public.notas_cavalo (
  id          uuid primary key default gen_random_uuid(),
  cavalo_id   uuid not null references public.cavalos (id) on delete cascade,
  autor_id    uuid not null references public.pessoas (id) on delete restrict,
  -- Quem escreveu era da equipa, no momento em que escreveu.
  --
  -- É uma cópia e não uma consulta a `pessoas.perfil` de propósito: um
  -- tratador que mude de perfil daqui a um ano não deve reescrever quem
  -- respondeu a quem. É também o que diz se uma conversa está por responder.
  de_equipa   boolean not null,
  texto       text not null check (length(btrim(texto)) between 1 and 2000),
  criado_em   timestamptz not null default now()
);

comment on table public.notas_cavalo is
  'Conversa por cavalo entre o dono e a equipa. Não é chat: é o caderno do cavalo, e serve também os pedidos de correcção de dados.';

create index notas_cavalo_por_cavalo on public.notas_cavalo (cavalo_id, criado_em desc);

-- --- Quem escreveu, e de que lado -------------------------------------------
-- O autor e o lado não vêm da aplicação: são carimbados aqui. Deixar a
-- aplicação dizer quem escreveu era deixá-la escrever em nome de outro.

create or replace function public.carimbar_autor_da_nota()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.autor_id  := public.pessoa_actual_id();
  new.de_equipa := public.e_equipa();

  if new.autor_id is null then
    raise exception 'Sem ficha de pessoa para assinar a nota.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger notas_cavalo_carimbar_autor
  before insert on public.notas_cavalo
  for each row execute function public.carimbar_autor_da_nota();

-- --- RLS ---------------------------------------------------------------------
-- Lê e escreve quem vê o cavalo: a equipa, e o dono. A mesma regra de
-- `cavalos_ler` — e aqui o cliente **escreve**, que é a primeira vez nesta
-- aplicação. Não há registo público e o convite é a gestão que o manda, por
-- isso quem escreve é sempre alguém que o centro conhece pelo nome.
--
-- Ninguém edita nem apaga uma nota: uma conversa reescrita depois do facto
-- não serve de caderno. Corrige-se escrevendo outra.

alter table public.notas_cavalo enable row level security;

create policy notas_cavalo_ler on public.notas_cavalo
  for select to authenticated
  using (
    public.e_equipa()
    or cavalo_id in (
      select c.id from public.cavalos c
       where c.proprietario_id = public.pessoa_actual_id()
    )
  );

create policy notas_cavalo_escrever on public.notas_cavalo
  for insert to authenticated
  with check (
    public.e_equipa()
    or cavalo_id in (
      select c.id from public.cavalos c
       where c.proprietario_id = public.pessoa_actual_id()
    )
  );

create policy notas_cavalo_apagar on public.notas_cavalo
  for delete to authenticated
  using (public.e_gestao());

-- --- Vista -------------------------------------------------------------------
-- Uma linha por cavalo que tem conversa, com a última palavra e de que lado
-- veio. É isto que faz o contador de «por responder» não custar sessenta
-- consultas.

create view public.v_notas_por_responder
with (security_invoker = on) as
select
  c.id                        as cavalo_id,
  c.nome                      as cavalo_nome,
  n.id                        as ultima_nota_id,
  n.texto                     as ultimo_texto,
  n.criado_em                 as ultima_em,
  n.de_equipa                 as ultima_de_equipa,
  not n.de_equipa             as por_responder,
  total.quantas               as total_notas
from public.cavalos c
join lateral (
  select ns.*
    from public.notas_cavalo ns
   where ns.cavalo_id = c.id
   order by ns.criado_em desc
   limit 1
) n on true
join lateral (
  select count(*) as quantas
    from public.notas_cavalo ns
   where ns.cavalo_id = c.id
) total on true;

comment on view public.v_notas_por_responder is
  'Cavalos com conversa, com a última palavra e de que lado veio. por_responder = a última foi do cliente.';

grant select on public.v_notas_por_responder to authenticated;
