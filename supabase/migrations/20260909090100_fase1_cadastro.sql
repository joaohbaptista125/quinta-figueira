-- =============================================================================
-- Fase 1 — Cadastro base: pessoas, papéis, cavalos, boxes, contratos de penso
-- =============================================================================

-- --- pessoas ----------------------------------------------------------------
-- Uma pessoa existe independentemente de ter (ou vir a ter) conta de acesso.
-- auth_user_id liga-a a auth.users quando lhe for dado login; até lá é null.
-- Isto permite digitar as ~80 pessoas de uma vez e activar os logins depois.
create table public.pessoas (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null check (length(btrim(nome)) > 0),
  email           text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefone        text,
  nif             text check (nif is null or nif ~ '^[0-9]{9}$'),
  morada          text,
  notas           text,
  activo          boolean not null default true,

  -- Acesso à aplicação (opcional)
  auth_user_id    uuid unique references auth.users (id) on delete set null,
  perfil          public.perfil_acesso,

  criado_em       timestamptz not null default now(),
  actualizado_em  timestamptz not null default now(),

  -- Quem tem login tem obrigatoriamente um perfil de acesso.
  constraint pessoas_login_exige_perfil
    check (auth_user_id is null or perfil is not null)
);

create unique index pessoas_email_unico
  on public.pessoas (lower(email)) where email is not null;
create unique index pessoas_nif_unico
  on public.pessoas (nif) where nif is not null;
create index pessoas_nome_idx on public.pessoas (nome);
create index pessoas_activo_idx on public.pessoas (activo) where activo;

create trigger pessoas_actualizado_em
  before update on public.pessoas
  for each row execute function public.tocar_actualizado_em();

comment on table public.pessoas is
  'Alunos, proprietários, instrutores, tratadores e jogadores. O login é opcional (auth_user_id).';
comment on column public.pessoas.perfil is
  'Perfil de ACESSO à aplicação. Distinto dos papéis de domínio em pessoa_papeis.';

-- --- pessoa_papeis ----------------------------------------------------------
-- Papéis como relação, não como coluna "tipo": uma pessoa pode ser
-- simultaneamente aluno, proprietário e jogador de horseball.
create table public.pessoa_papeis (
  pessoa_id  uuid not null references public.pessoas (id) on delete cascade,
  papel      public.papel_pessoa not null,
  criado_em  timestamptz not null default now(),
  primary key (pessoa_id, papel)
);

create index pessoa_papeis_papel_idx on public.pessoa_papeis (papel);

-- --- cavalos ----------------------------------------------------------------
create table public.cavalos (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null check (length(btrim(nome)) > 0),
  data_nascimento  date check (data_nascimento is null or data_nascimento <= current_date),
  sexo             public.sexo_cavalo,
  raca             text,
  pelagem          text,
  num_passaporte   text,
  microchip        text,
  foto_path        text,            -- caminho no bucket 'cavalos' do Storage
  regime           public.regime_cavalo not null,
  proprietario_id  uuid references public.pessoas (id) on delete restrict,
  activo           boolean not null default true,
  notas            text,
  criado_em        timestamptz not null default now(),
  actualizado_em   timestamptz not null default now(),

  -- Um cavalo a penso pertence sempre a um cliente.
  constraint cavalos_penso_exige_proprietario
    check (regime <> 'penso' or proprietario_id is not null)
);

create unique index cavalos_passaporte_unico
  on public.cavalos (num_passaporte) where num_passaporte is not null;
create unique index cavalos_microchip_unico
  on public.cavalos (microchip) where microchip is not null;
create index cavalos_nome_idx on public.cavalos (nome);
create index cavalos_proprietario_idx on public.cavalos (proprietario_id);
create index cavalos_regime_idx on public.cavalos (regime);

create trigger cavalos_actualizado_em
  before update on public.cavalos
  for each row execute function public.tocar_actualizado_em();

-- --- boxes ------------------------------------------------------------------
-- A atribuição vive na box (uma box tem no máximo um cavalo). cavalo_id é
-- unique mas anulável: em Postgres vários NULL não colidem, por isso podem
-- existir muitas boxes vazias.
create table public.boxes (
  id              uuid primary key default gen_random_uuid(),
  identificacao   text not null unique check (length(btrim(identificacao)) > 0),
  zona            text,
  cavalo_id       uuid unique references public.cavalos (id) on delete set null,
  activa          boolean not null default true,
  notas           text,
  criado_em       timestamptz not null default now(),
  actualizado_em  timestamptz not null default now()
);

create index boxes_zona_idx on public.boxes (zona);

create trigger boxes_actualizado_em
  before update on public.boxes
  for each row execute function public.tocar_actualizado_em();

-- --- contratos_penso --------------------------------------------------------
create table public.contratos_penso (
  id              uuid primary key default gen_random_uuid(),
  cavalo_id       uuid not null references public.cavalos (id) on delete restrict,
  cliente_id      uuid not null references public.pessoas (id) on delete restrict,
  valor_mensal    numeric(10, 2) not null check (valor_mensal >= 0),
  dia_vencimento  smallint not null default 1
                    check (dia_vencimento between 1 and 28),
  data_inicio     date not null,
  data_fim        date,             -- null = em vigor
  notas           text,
  criado_em       timestamptz not null default now(),
  actualizado_em  timestamptz not null default now(),

  constraint contratos_penso_datas_coerentes
    check (data_fim is null or data_fim >= data_inicio)
);

-- O mesmo cavalo não pode ter dois contratos a sobrepor-se no tempo.
alter table public.contratos_penso
  add constraint contratos_penso_sem_sobreposicao
  exclude using gist (
    cavalo_id with =,
    daterange(data_inicio, data_fim, '[]') with &&
  );

create index contratos_penso_cliente_idx on public.contratos_penso (cliente_id);
create index contratos_penso_cavalo_idx on public.contratos_penso (cavalo_id);

create trigger contratos_penso_actualizado_em
  before update on public.contratos_penso
  for each row execute function public.tocar_actualizado_em();

comment on column public.contratos_penso.dia_vencimento is
  'Dia do mês em que a mensalidade vence. Limitado a 28 para existir em todos os meses.';
