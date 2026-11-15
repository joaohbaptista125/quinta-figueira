-- =============================================================================
-- Paddocks: que cavalos estão largados hoje, e em qual
-- =============================================================================
-- São oito campos, numerados de 1 a 8. A pergunta que isto responde é a de
-- quem chega de manhã à cavalariça: **quem já saiu, e para onde**. É
-- coordenação entre tratadores, e hoje fazia-se de cabeça.
--
-- Decisões, e porquê:
--
-- * **Vários cavalos por paddock.** Um campo de largada leva mais do que um,
--   e foi o que o centro pediu. Daí a ocupação ser uma tabela e não uma
--   coluna — o contrário das boxes, em que `boxes.cavalo_id` era único
--   porque numa box só cabe um.
-- * **A ocupação vive à parte de `cavalos`.** `cavalos` só se edita com
--   `e_gestao()`, e quem larga os cavalos é o tratador. Pôr aqui uma coluna
--   obrigava a abrir `cavalos` à equipa inteira, ou a uma trigger a travar
--   colunas. Uma tabela própria resolve-o com uma política de três linhas.
-- * **Tem `data`, e o centro só olha para hoje.** O pedido foi «só interessa
--   hoje», e é isso que a aplicação mostra. A data existe para o quadro **se
--   esvaziar sozinho à meia-noite**: sem ela, a largada de ontem ficava no
--   ecrã até alguém a apagar à mão, e um quadro que mente de manhã é pior do
--   que não haver quadro. Não há ecrã nenhum de histórico — e se um dia
--   fizer falta, já cá está o que é preciso.
-- * **Um cavalo num paddock de cada vez, por dia.** Não é restrição de
--   gestão, é aritmética: um cavalo não está em dois campos ao mesmo tempo.

create table public.paddocks (
  id              uuid primary key default gen_random_uuid(),
  numero          smallint not null unique check (numero > 0),
  -- Opcional: «o da fonte», «o de cima». Quem trabalha lá chama-lhes assim.
  nome            text,
  activo          boolean not null default true,
  notas           text,
  criado_em       timestamptz not null default now(),
  actualizado_em  timestamptz not null default now()
);

comment on table public.paddocks is
  'Os campos de largada. São oito, numerados — mas é tabela e não um número fixo para acrescentar o nono não ser uma migração.';

create trigger paddocks_actualizado_em
  before update on public.paddocks
  for each row execute function public.tocar_actualizado_em();

insert into public.paddocks (numero)
select generate_series(1, 8);

create table public.paddock_ocupacao (
  id              uuid primary key default gen_random_uuid(),
  paddock_id      uuid not null references public.paddocks (id) on delete cascade,
  cavalo_id       uuid not null references public.cavalos (id) on delete cascade,
  data            date not null default current_date,
  notas           text,
  criado_em       timestamptz not null default now(),

  -- Um cavalo não está em dois campos ao mesmo tempo.
  constraint paddock_ocupacao_cavalo_por_dia unique (cavalo_id, data)
);

comment on table public.paddock_ocupacao is
  'Que cavalos estão em cada paddock, por dia. A aplicação só mostra o dia de hoje; a data existe para o quadro se esvaziar sozinho à meia-noite.';

-- A pergunta é sempre «o quadro de hoje».
create index paddock_ocupacao_do_dia
  on public.paddock_ocupacao (data, paddock_id);

-- --- RLS ---------------------------------------------------------------------
-- Os paddocks em si são só uma lista, e toda a gente autenticada os pode ler;
-- mexer na lista é da gestão.
--
-- A ocupação lê-se como os cavalos: a equipa vê tudo, o dono vê os cavalos
-- dele — é o que lhe permite saber que o cavalo saiu hoje. **Escrever é de
-- `e_equipa()`**, como a ferração e pela mesma razão: quem larga os cavalos é
-- o tratador, e obrigá-lo a pedir à gestão era a maneira certa de o quadro
-- não existir.

alter table public.paddocks enable row level security;
alter table public.paddock_ocupacao enable row level security;

create policy paddocks_ler on public.paddocks
  for select to authenticated
  using (true);

create policy paddocks_gerir on public.paddocks
  for all to authenticated
  using (public.e_gestao())
  with check (public.e_gestao());

create policy paddock_ocupacao_ler on public.paddock_ocupacao
  for select to authenticated
  using (
    public.e_equipa()
    or cavalo_id in (
      select c.id from public.cavalos c
       where c.proprietario_id = public.pessoa_actual_id()
    )
  );

create policy paddock_ocupacao_gerir on public.paddock_ocupacao
  for all to authenticated
  using (public.e_equipa())
  with check (public.e_equipa());

-- --- As boxes saem -----------------------------------------------------------
-- Pedido explícito do centro, e **irreversível**: o que estivesse escrito nas
-- boxes perde-se com a tabela. Fica registado que foi uma decisão e não um
-- descuido — a secção não era usada, e os paddocks é que são a pergunta real
-- de quem trabalha na cavalariça.
--
-- `cavalos` não perde nada: a ligação vivia em `boxes.cavalo_id`, do lado que
-- desaparece.

drop table if exists public.boxes;
