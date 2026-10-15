-- =============================================================================
-- Encargos avulsos: o que se cobra ao cliente fora da mensalidade de penso
-- =============================================================================
-- A ferração é o caso que obrigou a isto: nuns clientes o ferrador cobra
-- directamente ao dono, noutros o centro paga e recobra. O segundo caso não
-- tinha onde viver — a aplicação só sabia cobrar o que nasce de um contrato
-- de penso, e uma mensalidade é por contrato × mês, não por acontecimento.
--
-- Um encargo é uma linha de «isto fica a dever-se»: a quem, quanto, porquê e
-- de que cavalo. O veterinário, o transporte e o estágio cabem aqui sem
-- migração nova — é de propósito.
--
-- O desenho é o mesmo das mensalidades, para quem já conhece uma reconhecer o
-- outro: o estado é **derivado** dos recebimentos imputados e não se escreve
-- à mão, e uma vista dá o valor pago e o valor em falta.

create type public.estado_encargo as enum ('pendente', 'pago', 'anulado');

create table public.encargos (
  id              uuid primary key default gen_random_uuid(),
  pessoa_id       uuid not null references public.pessoas (id) on delete restrict,
  -- O cavalo é contexto, não dono da dívida: apagar o cavalo não apaga o que
  -- ficou por pagar.
  cavalo_id       uuid references public.cavalos (id) on delete set null,
  -- De onde veio, quando veio de uma ferração. `set null` pela mesma razão.
  ferracao_id     uuid references public.ferracoes (id) on delete set null,
  descricao       text not null check (length(btrim(descricao)) > 0),
  valor           numeric(10, 2) not null check (valor >= 0),
  data            date not null default current_date,
  estado          public.estado_encargo not null default 'pendente',
  notas           text,
  criado_em       timestamptz not null default now(),
  actualizado_em  timestamptz not null default now()
);

comment on table public.encargos is
  'O que se cobra ao cliente fora da mensalidade de penso: ferração, veterinário, transporte. O estado é derivado dos recebimentos imputados — não o escrevas à mão.';

-- Uma ferração não se cobra duas vezes por distracção.
create unique index encargos_ferracao_unica on public.encargos (ferracao_id)
  where ferracao_id is not null;

create index encargos_por_pessoa on public.encargos (pessoa_id, data desc);
create index encargos_pendentes on public.encargos (estado) where estado = 'pendente';

create trigger encargos_actualizado_em
  before update on public.encargos
  for each row execute function public.tocar_actualizado_em();

-- --- A ligação ao dinheiro ---------------------------------------------------

alter table public.recebimentos
  add column encargo_id uuid references public.encargos (id) on delete set null;

-- Um recebimento paga uma mensalidade **ou** um encargo, nunca os dois: é
-- `mensalidade_id`/`encargo_id` que liga cada euro ao que respeita, e com os
-- dois preenchidos não se sabia a qual.
alter table public.recebimentos
  add constraint recebimentos_um_destino_de_cada_vez
    check (mensalidade_id is null or encargo_id is null);

create index recebimentos_encargo_idx
  on public.recebimentos (encargo_id) where encargo_id is not null;

-- --- Estado derivado ---------------------------------------------------------
-- Igual ao das mensalidades: pagamento parcial mantém `pendente`, apagar o
-- recebimento devolve a `pendente`, e `anulado` nunca é revertido sozinho.

create or replace function public.recalcular_estado_encargo(p_encargo uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_valor numeric(10, 2);
  v_pago  numeric(10, 2);
begin
  select valor into v_valor from public.encargos where id = p_encargo;
  if v_valor is null then return; end if;

  select coalesce(sum(valor), 0) into v_pago
    from public.recebimentos
   where encargo_id = p_encargo;

  update public.encargos
     set estado = (case when v_pago >= v_valor then 'pago' else 'pendente' end)
                    ::public.estado_encargo,
         actualizado_em = now()
   where id = p_encargo
     and estado <> 'anulado';
end;
$$;

create or replace function public.sincronizar_encargo_de_recebimento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.encargo_id is not null then
    perform public.recalcular_estado_encargo(old.encargo_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.encargo_id is not null then
    perform public.recalcular_estado_encargo(new.encargo_id);
  end if;

  return null;
end;
$$;

create trigger recebimentos_sincronizar_encargo
  after insert or update or delete on public.recebimentos
  for each row execute function public.sincronizar_encargo_de_recebimento();

-- --- RLS ---------------------------------------------------------------------
-- Um encargo é dinheiro: fora do alcance de instrutores e tratadores, como os
-- contratos e os recebimentos. O cliente vê os dele.

alter table public.encargos enable row level security;

create policy encargos_ler on public.encargos
  for select to authenticated
  using (public.e_gestao() or pessoa_id = public.pessoa_actual_id());

create policy encargos_gerir on public.encargos
  for all to authenticated
  using (public.e_gestao())
  with check (public.e_gestao());

-- --- Vista -------------------------------------------------------------------

create view public.v_encargos_por_receber
with (security_invoker = on) as
select
  e.id                                as encargo_id,
  e.pessoa_id,
  p.nome                              as pessoa_nome,
  e.cavalo_id,
  c.nome                              as cavalo_nome,
  e.ferracao_id,
  e.descricao,
  e.data,
  e.valor,
  e.estado,
  coalesce(pg.pago, 0)                as valor_pago,
  e.valor - coalesce(pg.pago, 0)      as valor_em_falta
from public.encargos e
join public.pessoas p on p.id = e.pessoa_id
left join public.cavalos c on c.id = e.cavalo_id
left join (
  select encargo_id, sum(valor) as pago
    from public.recebimentos
   where encargo_id is not null
   group by encargo_id
) pg on pg.encargo_id = e.id;

comment on view public.v_encargos_por_receber is
  'Encargos com o valor já pago e o que falta. security_invoker: a RLS é a de quem consulta.';

grant select on public.v_encargos_por_receber to authenticated;
