-- =============================================================================
-- «Já paguei»: o cliente declara, a gestão confirma
-- =============================================================================
-- Até aqui um recebimento só nascia de um lado: a gestão vê a transferência no
-- extracto e lança-a. O problema é o do meio — o extracto diz «TRF 180,00
-- JOAO B» e não diz de que mês era, nem de que cavalo, nem se eram dois meses
-- de uma vez. Quem sabe isso é quem pagou.
--
-- Uma declaração é **uma afirmação de quem paga**: «paguei 180 €, por MB WAY,
-- no dia 8, e era a mensalidade de Outubro». Não é dinheiro, não é um recibo,
-- e não é um recebimento.
--
-- **A regra que não cede: uma declaração não mexe em estado nenhum.**
-- `mensalidades_penso.estado` e `encargos.estado` continuam a ser derivados
-- **só** dos recebimentos imputados, e um recebimento continua a ser escrita
-- de gestão. Não há trigger nenhum daqui para lá — de propósito. Se houvesse,
-- qualquer cliente se dava por pago carregando num botão, e a aplicação
-- passava a ser um intermediário de pagamento em vez de um livro de registo.
--
-- O que existe é `confirmar_pagamento_declarado()`, que corre **com a
-- identidade de quem chama** (nada de SECURITY DEFINER aqui): cria o
-- recebimento e fecha a declaração na mesma transacção. Um cliente que a
-- chame esbarra na RLS de `recebimentos`, que é só da gestão — é a RLS a
-- travar, e não uma verificação de interface.
--
-- A gestão pode **corrigir ao confirmar**: o valor, a data e o método que
-- ficam no recebimento são os que ela confirmar, não os que o cliente
-- escreveu. Quem paga diz o que fez; quem recebe diz o que entrou.

create type public.estado_declaracao as enum (
  'pendente',
  'confirmada',
  'recusada'
);

create table public.pagamentos_declarados (
  id              uuid primary key default gen_random_uuid(),
  -- Carimbado por trigger, nunca enviado pela aplicação.
  pessoa_id       uuid not null references public.pessoas (id) on delete cascade,

  -- Contra o que é que isto foi pago. Um ou outro, nunca os dois — a mesma
  -- disciplina de `recebimentos`: com os dois preenchidos não se saberia a
  -- qual respeitava o dinheiro.
  mensalidade_id  uuid references public.mensalidades_penso (id) on delete cascade,
  encargo_id      uuid references public.encargos (id) on delete cascade,

  valor            numeric(12, 2) not null check (valor > 0),
  data             date not null,
  metodo_pagamento public.metodo_pagamento not null,
  -- O que o cliente tem à mão para a gestão encontrar o movimento no
  -- extracto: «MB WAY 91…», «ref. 1234», «entreguei ao João».
  referencia       text,
  notas            text,

  -- O que a gestão decidiu. `decidido_por` e `decidido_em` são carimbados,
  -- como o autor.
  estado           public.estado_declaracao not null default 'pendente',
  recebimento_id   uuid references public.recebimentos (id) on delete set null,
  decidido_por     uuid references public.pessoas (id) on delete set null,
  decidido_em      timestamptz,
  motivo           text,

  criado_em        timestamptz not null default now(),
  actualizado_em   timestamptz not null default now(),

  constraint pagamentos_declarados_um_destino
    check (num_nonnulls(mensalidade_id, encargo_id) = 1),
  -- Uma declaração confirmada tem de dizer que recebimento é que a fechou.
  constraint pagamentos_declarados_confirmada_tem_recebimento
    check (estado <> 'confirmada' or recebimento_id is not null)
);

comment on table public.pagamentos_declarados is
  'Pagamentos que o cliente diz ter feito, à espera de confirmação da gestão. NÃO é dinheiro: não mexe no estado de mensalidades nem de encargos — isso continua a derivar só dos recebimentos.';

comment on column public.pagamentos_declarados.valor is
  'O que o cliente diz ter pago. O valor que conta é o do recebimento que a gestão criar ao confirmar.';

create index pagamentos_declarados_pendentes
  on public.pagamentos_declarados (criado_em desc)
  where estado = 'pendente';

create index pagamentos_declarados_por_pessoa
  on public.pagamentos_declarados (pessoa_id, criado_em desc);

-- Carregar duas vezes no botão não declara duas vezes. É também isto que faz
-- a linha do cliente poder dizer «a aguardar confirmação» sem ambiguidade.
create unique index pagamentos_declarados_um_pendente_por_mensalidade
  on public.pagamentos_declarados (mensalidade_id)
  where estado = 'pendente' and mensalidade_id is not null;

create unique index pagamentos_declarados_um_pendente_por_encargo
  on public.pagamentos_declarados (encargo_id)
  where estado = 'pendente' and encargo_id is not null;

create trigger pagamentos_declarados_tocar
  before update on public.pagamentos_declarados
  for each row execute function public.tocar_actualizado_em();

-- --- Quem declarou, e quem decidiu -------------------------------------------
-- Nem um nem outro vêm da aplicação. Deixá-la dizer quem declarou era
-- deixá-la declarar em nome de outro; deixá-la mandar o estado era deixar
-- quem paga dar-se por pago.

create or replace function public.carimbar_pagamento_declarado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.pessoa_id := public.pessoa_actual_id();

  if new.pessoa_id is null then
    raise exception 'Sem ficha de pessoa para assinar a declaração.'
      using errcode = '42501';
  end if;

  -- Uma declaração nasce sempre por confirmar, venha o que vier no INSERT.
  new.estado         := 'pendente';
  new.recebimento_id := null;
  new.decidido_por   := null;
  new.decidido_em    := null;
  new.motivo         := null;

  return new;
end;
$$;

create trigger pagamentos_declarados_carimbar
  before insert on public.pagamentos_declarados
  for each row execute function public.carimbar_pagamento_declarado();

create or replace function public.carimbar_decisao_do_pagamento()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.estado is distinct from old.estado and new.estado <> 'pendente' then
    new.decidido_por := public.pessoa_actual_id();
    new.decidido_em  := now();
  end if;

  return new;
end;
$$;

create trigger pagamentos_declarados_carimbar_decisao
  before update on public.pagamentos_declarados
  for each row execute function public.carimbar_decisao_do_pagamento();

-- --- RLS ---------------------------------------------------------------------
-- É a segunda coisa que um cliente escreve nesta aplicação, depois das notas
-- de cavalo — e esta mexe com dinheiro, por isso a divisão é clara: **o
-- cliente declara, só a gestão decide.**

alter table public.pagamentos_declarados enable row level security;

create policy pagamentos_declarados_ler on public.pagamentos_declarados
  for select to authenticated
  using (public.e_gestao() or pessoa_id = public.pessoa_actual_id());

-- Declarar é do próprio, e só contra o que é dele. A verificação corre depois
-- do carimbo, por isso `pessoa_id` já é o da sessão quando chega aqui.
create policy pagamentos_declarados_declarar on public.pagamentos_declarados
  for insert to authenticated
  with check (
    pessoa_id = public.pessoa_actual_id()
    and (
      mensalidade_id in (
        select m.id
          from public.mensalidades_penso m
          join public.contratos_penso ct on ct.id = m.contrato_id
         where ct.cliente_id = public.pessoa_actual_id()
      )
      or encargo_id in (
        select e.id
          from public.encargos e
         where e.pessoa_id = public.pessoa_actual_id()
      )
    )
  );

-- Decidir é só da gestão. É esta política que impede o cliente de se dar por
-- pago, e é por isso que ela existe em vez de uma verificação no código.
create policy pagamentos_declarados_decidir on public.pagamentos_declarados
  for update to authenticated
  using (public.e_gestao())
  with check (public.e_gestao());

-- Retirar: o próprio enquanto ninguém decidiu — enganou-se no mês, ainda não
-- tinha pago afinal — e a gestão sempre.
create policy pagamentos_declarados_apagar on public.pagamentos_declarados
  for delete to authenticated
  using (
    public.e_gestao()
    or (pessoa_id = public.pessoa_actual_id() and estado = 'pendente')
  );

-- --- Confirmar ---------------------------------------------------------------
-- O recebimento e o fecho da declaração numa só transacção. Sem isto, um erro
-- entre os dois passos deixava dinheiro lançado com a declaração ainda por
-- confirmar — e a gestão a confirmá-la outra vez, a lançar o dobro.
--
-- **Não é SECURITY DEFINER**, de propósito: corre com a identidade de quem
-- chama, e é a RLS de `recebimentos` (só gestão) que trava um cliente que a
-- tente chamar. A função não precisa de privilégio nenhum para ser atómica.

create or replace function public.confirmar_pagamento_declarado(
  p_declaracao uuid,
  p_conta      uuid,
  p_valor      numeric default null,
  p_data       date default null,
  p_metodo     public.metodo_pagamento default null
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  d             public.pagamentos_declarados;
  v_periodo     date;
  v_tipo        public.tipo_recebimento;
  v_descricao   text;
  v_recebimento uuid;
begin
  -- Isto é para a mensagem de erro ser verdade, e não para ser a protecção: a
  -- RLS de `recebimentos` já recusa sozinha, mas recusava com «declaração não
  -- encontrada» (o `for update` em baixo passa pela política de UPDATE, que é
  -- só da gestão). **Se alguém tornar esta função SECURITY DEFINER, esta linha
  -- deixa de chegar** — não a torne.
  if not public.e_gestao() then
    raise exception 'Sem permissão para confirmar pagamentos.' using errcode = '42501';
  end if;

  -- `for update` para dois ecrãs da gestão abertos ao mesmo tempo não
  -- confirmarem a mesma declaração duas vezes.
  select * into d
    from public.pagamentos_declarados
   where id = p_declaracao
     for update;

  if not found then
    raise exception 'Declaração de pagamento não encontrada.' using errcode = 'P0002';
  end if;

  if d.estado <> 'pendente' then
    raise exception 'Esta declaração já foi decidida.' using errcode = '22023';
  end if;

  if d.mensalidade_id is not null then
    select m.periodo into v_periodo
      from public.mensalidades_penso m
     where m.id = d.mensalidade_id;
    v_tipo := 'penso';
  else
    select e.descricao into v_descricao
      from public.encargos e
     where e.id = d.encargo_id;
    v_tipo := 'outro';
  end if;

  insert into public.recebimentos (
    data, pessoa_id, valor, metodo_pagamento, conta_id,
    tipo, mensalidade_id, encargo_id, periodo, descricao
  ) values (
    coalesce(p_data, d.data),
    d.pessoa_id,
    coalesce(p_valor, d.valor),
    coalesce(p_metodo, d.metodo_pagamento),
    p_conta,
    v_tipo,
    d.mensalidade_id,
    d.encargo_id,
    v_periodo,
    v_descricao
  )
  returning id into v_recebimento;

  update public.pagamentos_declarados
     set estado = 'confirmada',
         recebimento_id = v_recebimento,
         motivo = null
   where id = d.id;

  return v_recebimento;
end;
$$;

comment on function public.confirmar_pagamento_declarado is
  'Cria o recebimento e fecha a declaração na mesma transacção. Corre com a identidade de quem chama: a RLS de recebimentos é que decide quem pode.';

grant execute on function public.confirmar_pagamento_declarado(
  uuid, uuid, numeric, date, public.metodo_pagamento
) to authenticated;

-- --- Vista -------------------------------------------------------------------
-- O que está por confirmar, com o nome de quem declarou e contra o que — e,
-- ao lado, o que falta mesmo desse item. É a comparação que a gestão faz:
-- «diz que pagou 180, e falta 180» passa; «diz 180 e falta 360» é conversa.

create view public.v_pagamentos_por_confirmar
with (security_invoker = on) as
select
  d.id                    as declaracao_id,
  d.pessoa_id,
  p.nome                  as pessoa_nome,
  p.telefone              as pessoa_telefone,
  d.mensalidade_id,
  d.encargo_id,
  d.valor,
  d.data,
  d.metodo_pagamento,
  d.referencia,
  d.notas,
  d.criado_em,
  case when d.mensalidade_id is not null then 'penso' else 'encargo' end as respeita_a,
  pr.periodo,
  pr.cavalo_nome,
  er.descricao            as encargo_descricao,
  -- Null quando o item desapareceu ou foi anulado: isso é precisamente o que a
  -- gestão precisa de ver antes de confirmar.
  coalesce(pr.valor_em_falta, er.valor_em_falta) as valor_em_falta
from public.pagamentos_declarados d
join public.pessoas p on p.id = d.pessoa_id
left join public.v_pensos_por_receber pr on pr.mensalidade_id = d.mensalidade_id
left join public.v_encargos_por_receber er on er.encargo_id = d.encargo_id
where d.estado = 'pendente';

comment on view public.v_pagamentos_por_confirmar is
  'Declarações de pagamento por confirmar, com o que falta do item a que respeitam. security_invoker: a RLS é a de quem consulta.';

grant select on public.v_pagamentos_por_confirmar to authenticated;
