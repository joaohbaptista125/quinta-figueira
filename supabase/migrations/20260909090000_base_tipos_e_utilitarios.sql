-- =============================================================================
-- Quinta da Figueira — base: extensões, tipos enumerados e utilitários
-- =============================================================================
-- Convenções do esquema:
--   * Nomes de tabelas e colunas em português de Portugal.
--   * Chaves primárias uuid geradas por gen_random_uuid().
--   * Todas as tabelas têm criado_em / actualizado_em (timestamptz).
--   * Valores monetários em numeric — EUR. Nunca float.
-- =============================================================================

-- gen_random_uuid() é nativa desde o PostgreSQL 13, não precisa de extensão.
-- btree_gist é preciso para a restrição de exclusão em contratos_penso
-- (impede contratos sobrepostos para o mesmo cavalo).
create extension if not exists btree_gist with schema extensions;

-- --- Tipos enumerados -------------------------------------------------------

-- Sexo do cavalo. "castrado" é um estado distinto de "macho" na prática equestre.
create type public.sexo_cavalo as enum ('macho', 'femea', 'castrado');

-- Regime do cavalo no centro:
--   penso  — cavalo de cliente, alojado a pensão (exige proprietário e contrato)
--   escola — cavalo usado nas aulas da escola de equitação
--   centro — propriedade do próprio centro hípico
create type public.regime_cavalo as enum ('penso', 'escola', 'centro');

-- Papéis de DOMÍNIO. Uma pessoa pode acumular vários em simultâneo.
-- Não confundir com perfil_acesso: isto descreve o que a pessoa faz no centro,
-- não o que pode ver na aplicação.
create type public.papel_pessoa as enum (
  'aluno',
  'proprietario',
  'instrutor',
  'tratador',
  'jogador_horseball'
);

-- Perfil de ACESSO. Único por pessoa, determina o que a RLS deixa ver.
create type public.perfil_acesso as enum (
  'admin',
  'gestor',
  'instrutor',
  'tratador',
  'cliente'
);

-- Meios de pagamento usados no centro. Aparece em despesas e recebimentos.
create type public.metodo_pagamento as enum (
  'dinheiro',
  'transferencia',
  'mbway',
  'multibanco',
  'cheque',
  'debito_directo'
);

create type public.tipo_conta as enum ('caixa', 'banco');

-- A que se refere um recebimento. 'aulas' fica preparado para a Fase 3.
create type public.tipo_recebimento as enum ('penso', 'aulas', 'outro');

create type public.estado_mensalidade as enum ('pendente', 'paga', 'anulada');

-- --- Utilitários ------------------------------------------------------------

-- Trigger genérico para manter actualizado_em.
create or replace function public.tocar_actualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_em := now();
  return new;
end;
$$;

comment on function public.tocar_actualizado_em() is
  'Trigger BEFORE UPDATE: mantém a coluna actualizado_em.';

-- Normaliza uma data para o primeiro dia do respectivo mês.
-- Usado para o "período" de mensalidades e recebimentos.
create or replace function public.primeiro_dia_do_mes(p_data date)
returns date
language sql
immutable
as $$
  select date_trunc('month', p_data)::date;
$$;
