-- =============================================================================
-- Fase 3 — Eventos: aulas, treinos de Horseball e competições
-- =============================================================================
-- Um só modelo para as três coisas. Partilham data, hora, local, responsável,
-- participantes, presenças e avisos; o que muda é o `tipo`. Isso dá um quadro
-- do dia único e um só calendário para exportar, e acrescentar um tipo novo
-- (estágio, passeio) passa a não custar nada.
-- =============================================================================

create type public.tipo_evento as enum (
  'aula',
  'treino_horseball',
  'competicao'
);

-- Estado de cada pessoa convocada. 'dispensado' é a falta justificada.
create type public.estado_participacao as enum (
  'convocado',
  'presente',
  'faltou',
  'dispensado'
);

-- --- equipas ----------------------------------------------------------------
-- Um conjunto de jogadores que costuma treinar junto. Serve para pré-preencher
-- a convocatória de um treino, não para restringir quem lá pode estar.
create table public.equipas (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null unique check (length(btrim(nome)) > 0),
  escalao         text,
  notas           text,
  activa          boolean not null default true,
  criado_em       timestamptz not null default now(),
  actualizado_em  timestamptz not null default now()
);

create trigger equipas_actualizado_em
  before update on public.equipas
  for each row execute function public.tocar_actualizado_em();

create table public.equipa_membros (
  equipa_id  uuid not null references public.equipas (id) on delete cascade,
  pessoa_id  uuid not null references public.pessoas (id) on delete cascade,
  criado_em  timestamptz not null default now(),
  primary key (equipa_id, pessoa_id)
);

create index equipa_membros_pessoa_idx on public.equipa_membros (pessoa_id);

-- --- eventos ----------------------------------------------------------------
create table public.eventos (
  id              uuid primary key default gen_random_uuid(),
  tipo            public.tipo_evento not null,
  titulo          text,
  data            date not null,
  hora_inicio     time not null,
  hora_fim        time,
  local           text,
  -- Quem dá a aula ou orienta o treino.
  responsavel_id  uuid references public.pessoas (id) on delete set null,
  -- Só faz sentido em treinos; serve para pré-preencher a convocatória.
  equipa_id       uuid references public.equipas (id) on delete set null,
  notas           text,
  cancelado       boolean not null default false,
  motivo_cancelamento text,
  -- Gancho da Fase 4: ligar a aula ao recebimento que a pagou.
  recebimento_id  uuid references public.recebimentos (id) on delete set null,
  criado_por      uuid references auth.users (id) on delete set null,
  criado_em       timestamptz not null default now(),
  actualizado_em  timestamptz not null default now(),

  constraint eventos_horas_coerentes
    check (hora_fim is null or hora_fim > hora_inicio)
);

create index eventos_data_idx on public.eventos (data, hora_inicio);
create index eventos_tipo_idx on public.eventos (tipo);
create index eventos_responsavel_idx on public.eventos (responsavel_id);
create index eventos_equipa_idx on public.eventos (equipa_id) where equipa_id is not null;

create trigger eventos_actualizado_em
  before update on public.eventos
  for each row execute function public.tocar_actualizado_em();

comment on column public.eventos.titulo is
  'Opcional. Sem título, a interface usa o rótulo do tipo.';

-- --- evento_participantes ---------------------------------------------------
-- Cada pessoa convocada e, quando aplicável, o cavalo que vai montar.
create table public.evento_participantes (
  id          uuid primary key default gen_random_uuid(),
  evento_id   uuid not null references public.eventos (id) on delete cascade,
  pessoa_id   uuid not null references public.pessoas (id) on delete restrict,
  cavalo_id   uuid references public.cavalos (id) on delete set null,
  estado      public.estado_participacao not null default 'convocado',
  notas       text,

  -- Cópia da janela do evento, mantida por trigger. Existe só para sustentar a
  -- restrição de exclusão abaixo, que não consegue olhar para outra tabela.
  -- Fica a null quando não há cavalo ou o evento está cancelado — e as
  -- restrições de exclusão ignoram linhas com operandos nulos, que é
  -- exactamente o que se quer.
  periodo     tsrange,

  criado_em       timestamptz not null default now(),
  actualizado_em  timestamptz not null default now(),

  constraint evento_participantes_pessoa_unica unique (evento_id, pessoa_id)
);

create index evento_participantes_evento_idx on public.evento_participantes (evento_id);
create index evento_participantes_pessoa_idx on public.evento_participantes (pessoa_id);
create index evento_participantes_cavalo_idx on public.evento_participantes (cavalo_id)
  where cavalo_id is not null;

-- O mesmo cavalo não pode estar em dois eventos que se sobreponham no tempo.
alter table public.evento_participantes
  add constraint evento_participantes_cavalo_sem_sobreposicao
  exclude using gist (cavalo_id with =, periodo with &&);

create trigger evento_participantes_actualizado_em
  before update on public.evento_participantes
  for each row execute function public.tocar_actualizado_em();

-- --- avisos -----------------------------------------------------------------
-- Comunicação de um para muitos: o responsável escreve, quem está convocado lê.
-- Pertence a um evento ou a uma equipa, nunca aos dois.
create table public.avisos (
  id          uuid primary key default gen_random_uuid(),
  evento_id   uuid references public.eventos (id) on delete cascade,
  equipa_id   uuid references public.equipas (id) on delete cascade,
  texto       text not null check (length(btrim(texto)) > 0),
  autor_id    uuid references public.pessoas (id) on delete set null,
  criado_por  uuid references auth.users (id) on delete set null,
  criado_em       timestamptz not null default now(),
  actualizado_em  timestamptz not null default now(),

  constraint avisos_pertence_a_um_so
    check (num_nonnulls(evento_id, equipa_id) = 1)
);

create index avisos_evento_idx on public.avisos (evento_id) where evento_id is not null;
create index avisos_equipa_idx on public.avisos (equipa_id) where equipa_id is not null;

create trigger avisos_actualizado_em
  before update on public.avisos
  for each row execute function public.tocar_actualizado_em();

-- --- Sincronização da janela de tempo ---------------------------------------
-- Sem hora de fim assume-se uma hora, que é a duração normal de uma aula e
-- evita que um evento sem fim declarado bloqueie o cavalo o dia todo.
create or replace function public.janela_do_evento(p_evento public.eventos)
returns tsrange
language sql
immutable
as $$
  select case
    when p_evento.cancelado then null
    else tsrange(
      (p_evento.data + p_evento.hora_inicio)::timestamp,
      (p_evento.data + coalesce(p_evento.hora_fim, p_evento.hora_inicio + interval '1 hour'))::timestamp,
      '[)'
    )
  end;
$$;

create or replace function public.preencher_periodo_participante()
returns trigger
language plpgsql
as $$
declare
  v_evento public.eventos;
begin
  if new.cavalo_id is null then
    new.periodo := null;
    return new;
  end if;

  select * into v_evento from public.eventos where id = new.evento_id;
  new.periodo := public.janela_do_evento(v_evento);
  return new;
end;
$$;

create trigger evento_participantes_preencher_periodo
  before insert or update of evento_id, cavalo_id on public.evento_participantes
  for each row execute function public.preencher_periodo_participante();

-- Mudar a hora ou cancelar um evento tem de arrastar os participantes, senão a
-- restrição passa a olhar para horas que já não são as do evento.
create or replace function public.propagar_janela_do_evento()
returns trigger
language plpgsql
as $$
begin
  if new.data is distinct from old.data
     or new.hora_inicio is distinct from old.hora_inicio
     or new.hora_fim is distinct from old.hora_fim
     or new.cancelado is distinct from old.cancelado
  then
    update public.evento_participantes
       set periodo = case
             when cavalo_id is null then null
             else public.janela_do_evento(new)
           end
     where evento_id = new.id;
  end if;
  return null;
end;
$$;

create trigger eventos_propagar_janela
  after update on public.eventos
  for each row execute function public.propagar_janela_do_evento();
