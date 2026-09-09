-- =============================================================================
-- Fase 2 — Financeiro: contas, categorias, fornecedores, despesas,
--                      mensalidades de penso e recebimentos
-- =============================================================================
-- IMPORTANTE: esta aplicação NÃO emite documentos fiscais. Em Portugal, faturas
-- e recibos têm de ser emitidos por software certificado pela AT. Aqui regista-
-- se apenas o MOVIMENTO DE DINHEIRO. Os campos documento_fiscal_* em
-- recebimentos existem só para guardar a referência de um documento emitido
-- externamente (Vendus / InvoiceXpress / Moloni) numa integração futura.
-- =============================================================================

-- --- contas -----------------------------------------------------------------
-- Onde o dinheiro está. Ex.: "Caixa" (dinheiro), "CGD ...1234" (banco).
create table public.contas (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null unique check (length(btrim(nome)) > 0),
  tipo            public.tipo_conta not null,
  iban            text,
  saldo_inicial   numeric(12, 2) not null default 0,
  activa          boolean not null default true,
  notas           text,
  criado_em       timestamptz not null default now(),
  actualizado_em  timestamptz not null default now()
);

create trigger contas_actualizado_em
  before update on public.contas
  for each row execute function public.tocar_actualizado_em();

comment on column public.contas.saldo_inicial is
  'Saldo à data de arranque da aplicação. O saldo actual é calculado em v_saldos_contas.';

-- --- categorias_despesa -----------------------------------------------------
create table public.categorias_despesa (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null unique check (length(btrim(nome)) > 0),
  slug            text not null unique,
  ordem           smallint not null default 100,
  activa          boolean not null default true,
  criado_em       timestamptz not null default now(),
  actualizado_em  timestamptz not null default now()
);

create trigger categorias_despesa_actualizado_em
  before update on public.categorias_despesa
  for each row execute function public.tocar_actualizado_em();

-- Dados iniciais. Vão numa migração (e não em seed.sql) porque são dados de
-- referência que a instalação de produção também precisa de ter.
insert into public.categorias_despesa (nome, slug, ordem) values
  ('Ração',                     'racao',              10),
  ('Palha',                     'palha',              20),
  ('Feno',                      'feno',               30),
  ('Serradura',                 'serradura',          40),
  ('Aparas',                    'aparas',             50),
  ('Salários de tratadores',    'salarios-tratadores',60),
  ('Veterinário',               'veterinario',        70),
  ('Ferrador',                  'ferrador',           80),
  ('Melhoramentos do espaço',   'melhoramentos',      90),
  ('Equipamento e material',    'equipamento',       100),
  ('Seguros',                   'seguros',           110),
  ('Combustível',               'combustivel',       120),
  ('Outros',                    'outros',            999)
on conflict (slug) do nothing;

-- --- fornecedores -----------------------------------------------------------
create table public.fornecedores (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null check (length(btrim(nome)) > 0),
  nif             text check (nif is null or nif ~ '^[0-9]{9}$'),
  email           text,
  telefone        text,
  morada          text,
  activo          boolean not null default true,
  notas           text,
  criado_em       timestamptz not null default now(),
  actualizado_em  timestamptz not null default now()
);

create unique index fornecedores_nome_unico on public.fornecedores (lower(nome));
create unique index fornecedores_nif_unico
  on public.fornecedores (nif) where nif is not null;

create trigger fornecedores_actualizado_em
  before update on public.fornecedores
  for each row execute function public.tocar_actualizado_em();

-- --- despesas ---------------------------------------------------------------
-- Regista-se o VALOR TOTAL (o que efectivamente sai da conta, tal como aparece
-- no talão) e a taxa de IVA. A base tributável e o valor do IVA são colunas
-- calculadas, para o lançamento na cavalariça ser um campo só.
create table public.despesas (
  id                uuid primary key default gen_random_uuid(),
  data              date not null default current_date,
  categoria_id      uuid not null references public.categorias_despesa (id) on delete restrict,
  fornecedor_id     uuid references public.fornecedores (id) on delete set null,
  descricao         text not null check (length(btrim(descricao)) > 0),

  valor_total       numeric(12, 2) not null check (valor_total >= 0),
  taxa_iva          numeric(5, 2) not null default 23
                      check (taxa_iva >= 0 and taxa_iva <= 100),
  valor_base        numeric(12, 2)
                      generated always as
                      (round(valor_total / (1 + taxa_iva / 100), 2)) stored,
  valor_iva         numeric(12, 2)
                      generated always as
                      (valor_total - round(valor_total / (1 + taxa_iva / 100), 2)) stored,

  metodo_pagamento  public.metodo_pagamento not null,
  conta_id          uuid not null references public.contas (id) on delete restrict,
  paga              boolean not null default true,
  data_pagamento    date,

  cavalo_id         uuid references public.cavalos (id) on delete set null,
  anexo_path        text,          -- caminho no bucket 'documentos' do Storage
  notas             text,

  criado_por        uuid references auth.users (id) on delete set null,
  criado_em         timestamptz not null default now(),
  actualizado_em    timestamptz not null default now()
);

create index despesas_data_idx on public.despesas (data desc);
create index despesas_categoria_idx on public.despesas (categoria_id);
create index despesas_fornecedor_idx on public.despesas (fornecedor_id);
create index despesas_conta_idx on public.despesas (conta_id);
create index despesas_cavalo_idx on public.despesas (cavalo_id) where cavalo_id is not null;
create index despesas_por_pagar_idx on public.despesas (data) where not paga;

create trigger despesas_actualizado_em
  before update on public.despesas
  for each row execute function public.tocar_actualizado_em();

-- Uma despesa marcada como paga sem data de pagamento assume a data da despesa;
-- se deixar de estar paga, a data é limpa. Evita um campo extra no formulário.
create or replace function public.normalizar_pagamento_despesa()
returns trigger
language plpgsql
as $$
begin
  if new.paga and new.data_pagamento is null then
    new.data_pagamento := new.data;
  elsif not new.paga then
    new.data_pagamento := null;
  end if;
  return new;
end;
$$;

create trigger despesas_normalizar_pagamento
  before insert or update on public.despesas
  for each row execute function public.normalizar_pagamento_despesa();

comment on column public.despesas.cavalo_id is
  'Imputação opcional da despesa a um cavalo (ex.: veterinário, ferrador).';
comment on column public.despesas.paga is
  'Falso = despesa lançada mas ainda não saiu da conta. Só despesas pagas afectam o saldo.';

-- --- mensalidades_penso -----------------------------------------------------
-- Uma linha por contrato × mês. É o que permite responder a "que pensos deste
-- mês ainda não foram recebidos" e é a base da conta-corrente do cliente (Fase 4).
create table public.mensalidades_penso (
  id              uuid primary key default gen_random_uuid(),
  contrato_id     uuid not null references public.contratos_penso (id) on delete cascade,
  periodo         date not null,   -- sempre o dia 1 do mês
  valor           numeric(10, 2) not null check (valor >= 0),
  estado          public.estado_mensalidade not null default 'pendente',
  notas           text,
  criado_em       timestamptz not null default now(),
  actualizado_em  timestamptz not null default now(),

  constraint mensalidades_periodo_e_dia_1
    check (periodo = date_trunc('month', periodo)::date),
  constraint mensalidades_contrato_periodo_unico
    unique (contrato_id, periodo)
);

create index mensalidades_periodo_idx on public.mensalidades_penso (periodo desc);
create index mensalidades_pendentes_idx
  on public.mensalidades_penso (periodo) where estado = 'pendente';

create trigger mensalidades_actualizado_em
  before update on public.mensalidades_penso
  for each row execute function public.tocar_actualizado_em();

comment on table public.mensalidades_penso is
  'Mensalidades geradas a partir dos contratos de penso. Gerar com gerar_mensalidades(periodo).';

-- --- recebimentos -----------------------------------------------------------
create table public.recebimentos (
  id                uuid primary key default gen_random_uuid(),
  data              date not null default current_date,
  pessoa_id         uuid not null references public.pessoas (id) on delete restrict,
  valor             numeric(12, 2) not null check (valor > 0),
  metodo_pagamento  public.metodo_pagamento not null,
  conta_id          uuid not null references public.contas (id) on delete restrict,

  tipo              public.tipo_recebimento not null,
  mensalidade_id    uuid references public.mensalidades_penso (id) on delete set null,
  periodo           date,          -- mês a que respeita (dia 1)
  descricao         text,
  notas             text,

  -- Reservado para a integração futura com software certificado pela AT.
  -- NÃO emitir documentos fiscais a partir desta aplicação.
  documento_fiscal_ref         text,
  documento_fiscal_url         text,
  documento_fiscal_emitido_em  timestamptz,

  criado_por        uuid references auth.users (id) on delete set null,
  criado_em         timestamptz not null default now(),
  actualizado_em    timestamptz not null default now(),

  constraint recebimentos_mensalidade_so_em_penso
    check (mensalidade_id is null or tipo = 'penso'),
  constraint recebimentos_periodo_e_dia_1
    check (periodo is null or periodo = date_trunc('month', periodo)::date)
);

create index recebimentos_data_idx on public.recebimentos (data desc);
create index recebimentos_pessoa_idx on public.recebimentos (pessoa_id);
create index recebimentos_conta_idx on public.recebimentos (conta_id);
create index recebimentos_mensalidade_idx
  on public.recebimentos (mensalidade_id) where mensalidade_id is not null;

create trigger recebimentos_actualizado_em
  before update on public.recebimentos
  for each row execute function public.tocar_actualizado_em();

comment on column public.recebimentos.documento_fiscal_ref is
  'Referência do documento fiscal emitido em software certificado (AT). Preenchido por integração futura.';
