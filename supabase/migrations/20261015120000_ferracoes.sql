-- =============================================================================
-- Ferração: quando foi ferrado, se foi ferrado, quando volta a ser
-- =============================================================================
-- O ferrador passa no centro de seis em seis semanas e ninguém sabe de cor
-- quais são os cavalos da vez. O registo vivia num caderno, e o que falhava
-- era sempre o mesmo: o cavalo que ficou de fora da última volta.
--
-- Uma linha por ferração, e não um par de colunas em `cavalos`: o que
-- interessa é o histórico (de quanto em quanto tempo este cavalo precisa,
-- quem o ferrou, quanto custou), e duas colunas só sabem a última.
--
-- `proxima_em` é escrito à mão e não calculado. O intervalo não é igual para
-- todos — um cavalo de competição gasta mais depressa do que um de passeio —
-- e quem ferra sabe, ao sair, quando quer voltar.

create type public.tipo_ferracao as enum (
  'completa',   -- as quatro
  'maos',       -- só as da frente
  'pes',        -- só as de trás
  'arranjo'     -- casqueamento sem ferrar, ou a descalçar
);

create table public.ferracoes (
  id              uuid primary key default gen_random_uuid(),
  cavalo_id       uuid not null references public.cavalos (id) on delete cascade,
  data            date not null default current_date
                    check (data <= current_date),
  tipo            public.tipo_ferracao not null default 'completa',
  proxima_em      date,
  ferrador        text,
  custo           numeric(10, 2) check (custo is null or custo >= 0),
  notas           text,
  criado_em       timestamptz not null default now(),
  actualizado_em  timestamptz not null default now(),

  constraint ferracoes_proxima_depois_da_data
    check (proxima_em is null or proxima_em > data)
);

comment on table public.ferracoes is
  'Histórico de ferração de cada cavalo. proxima_em é a data combinada com o ferrador, não um cálculo.';

-- A pergunta é sempre «a última deste cavalo», e vem muitas vezes para
-- sessenta cavalos de uma vez.
create index ferracoes_por_cavalo on public.ferracoes (cavalo_id, data desc);
create index ferracoes_proximas on public.ferracoes (proxima_em)
  where proxima_em is not null;

create trigger ferracoes_actualizado_em
  before update on public.ferracoes
  for each row execute function public.tocar_actualizado_em();

-- --- RLS ---------------------------------------------------------------------
-- Ler segue a mesma regra dos cavalos: a equipa vê tudo, o cliente vê o que é
-- dos cavalos dele. Escrever é da equipa inteira e não só da gestão — quem
-- recebe o ferrador na cavalariça é o tratador, e obrigá-lo a pedir à gestão
-- para registar era a maneira certa de o registo não existir.

alter table public.ferracoes enable row level security;

create policy ferracoes_ler on public.ferracoes
  for select to authenticated
  using (
    public.e_equipa()
    or cavalo_id in (
      select c.id from public.cavalos c
       where c.proprietario_id = public.pessoa_actual_id()
    )
  );

create policy ferracoes_gerir on public.ferracoes
  for all to authenticated
  using (public.e_equipa())
  with check (public.e_equipa());

-- --- Vista -------------------------------------------------------------------
-- Uma linha por cavalo com a última ferração e a próxima prevista, para a
-- listagem não fazer sessenta consultas. `security_invoker` como todas as
-- outras: sem isso seria um buraco na RLS.

create view public.v_ferracao_cavalos
with (security_invoker = on) as
select
  c.id                                    as cavalo_id,
  c.nome                                  as cavalo_nome,
  c.activo,
  f.id                                    as ferracao_id,
  f.data                                  as ultima_em,
  f.tipo                                  as ultimo_tipo,
  f.ferrador,
  f.proxima_em,
  case
    when f.id is null then 'sem_registo'
    when f.proxima_em is null then 'sem_data'
    when f.proxima_em < current_date then 'atrasada'
    when f.proxima_em <= current_date + 7 then 'esta_semana'
    else 'em_dia'
  end                                     as estado
from public.cavalos c
left join lateral (
  select fe.*
    from public.ferracoes fe
   where fe.cavalo_id = c.id
   order by fe.data desc, fe.criado_em desc
   limit 1
) f on true;

comment on view public.v_ferracao_cavalos is
  'Última ferração de cada cavalo e o estado da próxima. Inclui os cavalos que nunca foram ferrados — que são precisamente os que interessa ver.';

grant select on public.v_ferracao_cavalos to authenticated;
