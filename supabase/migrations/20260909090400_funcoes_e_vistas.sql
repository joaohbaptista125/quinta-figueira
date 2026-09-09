-- =============================================================================
-- Funções de negócio e vistas de apoio ao dashboard
-- =============================================================================

-- --- Mensalidades de penso --------------------------------------------------

-- Reavalia o estado de uma mensalidade a partir dos recebimentos que lhe estão
-- imputados. Chamada pela trigger em recebimentos.
create or replace function public.recalcular_estado_mensalidade(p_mensalidade_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_valor  numeric(10, 2);
  v_estado public.estado_mensalidade;
  v_pago   numeric(12, 2);
  v_novo   public.estado_mensalidade;
begin
  if p_mensalidade_id is null then
    return;
  end if;

  select valor, estado into v_valor, v_estado
    from public.mensalidades_penso
   where id = p_mensalidade_id;

  -- Uma mensalidade anulada não volta atrás por causa de um recebimento.
  if not found or v_estado = 'anulada' then
    return;
  end if;

  select coalesce(sum(valor), 0) into v_pago
    from public.recebimentos
   where mensalidade_id = p_mensalidade_id;

  v_novo := case when v_pago >= v_valor then 'paga' else 'pendente' end;

  if v_novo is distinct from v_estado then
    update public.mensalidades_penso
       set estado = v_novo, actualizado_em = now()
     where id = p_mensalidade_id;
  end if;
end;
$$;

create or replace function public.sincronizar_mensalidade_de_recebimento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.mensalidade_id is not null then
    perform public.recalcular_estado_mensalidade(old.mensalidade_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.mensalidade_id is not null then
    perform public.recalcular_estado_mensalidade(new.mensalidade_id);
  end if;

  return null;
end;
$$;

create trigger recebimentos_sincronizar_mensalidade
  after insert or update or delete on public.recebimentos
  for each row execute function public.sincronizar_mensalidade_de_recebimento();

-- Gera as mensalidades de um mês a partir dos contratos em vigor.
-- Idempotente: correr duas vezes não duplica nada, e não mexe em mensalidades
-- já criadas (um valor excepcional editado à mão sobrevive).
create or replace function public.gerar_mensalidades(p_periodo date default current_date)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_mes     date := date_trunc('month', p_periodo)::date;
  v_fim_mes date := (date_trunc('month', p_periodo) + interval '1 month' - interval '1 day')::date;
  v_criadas integer;
begin
  if not public.e_gestao() then
    raise exception 'Sem permissão para gerar mensalidades.' using errcode = '42501';
  end if;

  insert into public.mensalidades_penso (contrato_id, periodo, valor)
  select ct.id, v_mes, ct.valor_mensal
    from public.contratos_penso ct
   where ct.data_inicio <= v_fim_mes
     and (ct.data_fim is null or ct.data_fim >= v_mes)
  on conflict (contrato_id, periodo) do nothing;

  get diagnostics v_criadas = row_count;
  return v_criadas;
end;
$$;

grant execute on function public.gerar_mensalidades(date) to authenticated;

comment on function public.gerar_mensalidades(date) is
  'Cria as mensalidades em falta do mês indicado a partir dos contratos em vigor. Idempotente.';

-- =============================================================================
-- Vistas
-- =============================================================================
-- Todas com security_invoker: a RLS aplicada é a de quem consulta, não a do
-- dono da vista. Sem isto uma vista seria um buraco na RLS.

-- --- Saldo por conta --------------------------------------------------------
-- Só despesas efectivamente pagas descontam do saldo.
create view public.v_saldos_contas
with (security_invoker = on) as
select
  c.id,
  c.nome,
  c.tipo,
  c.iban,
  c.activa,
  c.saldo_inicial,
  coalesce(r.total, 0)                                as total_recebido,
  coalesce(d.total, 0)                                as total_despesas_pagas,
  c.saldo_inicial + coalesce(r.total, 0) - coalesce(d.total, 0) as saldo_actual
from public.contas c
left join (
  select conta_id, sum(valor) as total
    from public.recebimentos
   group by conta_id
) r on r.conta_id = c.id
left join (
  select conta_id, sum(valor_total) as total
    from public.despesas
   where paga
   group by conta_id
) d on d.conta_id = c.id;

-- --- Resumo mensal (receitas vs. despesas) ----------------------------------
create view public.v_resumo_mensal
with (security_invoker = on) as
with rec as (
  select date_trunc('month', data)::date as periodo, sum(valor) as total
    from public.recebimentos
   group by 1
), des as (
  select date_trunc('month', data)::date as periodo,
         sum(valor_total)                        as total,
         sum(valor_total) filter (where paga)    as total_pago
    from public.despesas
   group by 1
)
select
  coalesce(rec.periodo, des.periodo)          as periodo,
  coalesce(rec.total, 0)                      as total_recebimentos,
  coalesce(des.total, 0)                      as total_despesas,
  coalesce(des.total_pago, 0)                 as total_despesas_pagas,
  coalesce(rec.total, 0) - coalesce(des.total, 0) as resultado
from rec
full outer join des on rec.periodo = des.periodo;

-- --- Despesa por categoria e mês --------------------------------------------
create view public.v_despesas_por_categoria
with (security_invoker = on) as
select
  date_trunc('month', d.data)::date as periodo,
  cat.id                            as categoria_id,
  cat.nome                          as categoria_nome,
  cat.slug                          as categoria_slug,
  cat.ordem                         as categoria_ordem,
  count(*)                          as num_despesas,
  sum(d.valor_total)                as total
from public.despesas d
join public.categorias_despesa cat on cat.id = d.categoria_id
group by 1, 2, 3, 4, 5;

-- --- Pensos por receber -----------------------------------------------------
-- Alimenta o widget "pensos do mês ainda não recebidos" do dashboard.
create view public.v_pensos_por_receber
with (security_invoker = on) as
select
  m.id                                    as mensalidade_id,
  m.periodo,
  m.valor,
  m.estado,
  ct.id                                   as contrato_id,
  ct.dia_vencimento,
  cav.id                                  as cavalo_id,
  cav.nome                                as cavalo_nome,
  cli.id                                  as cliente_id,
  cli.nome                                as cliente_nome,
  cli.telefone                            as cliente_telefone,
  cli.email                               as cliente_email,
  coalesce(pg.pago, 0)                    as valor_pago,
  m.valor - coalesce(pg.pago, 0)          as valor_em_falta
from public.mensalidades_penso m
join public.contratos_penso ct on ct.id = m.contrato_id
join public.cavalos cav        on cav.id = ct.cavalo_id
join public.pessoas cli        on cli.id = ct.cliente_id
left join (
  select mensalidade_id, sum(valor) as pago
    from public.recebimentos
   where mensalidade_id is not null
   group by mensalidade_id
) pg on pg.mensalidade_id = m.id
where m.estado <> 'anulada';

grant select on
  public.v_saldos_contas,
  public.v_resumo_mensal,
  public.v_despesas_por_categoria,
  public.v_pensos_por_receber
to authenticated;
