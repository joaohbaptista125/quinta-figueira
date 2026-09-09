-- =============================================================================
-- Dados de demonstração para desenvolvimento local (`supabase db reset`).
--
-- NÃO correr em produção. As categorias de despesa reais vivem numa migração,
-- não aqui — isto é só material para poder clicar na aplicação.
-- =============================================================================

-- --- Contas -----------------------------------------------------------------
insert into public.contas (id, nome, tipo, iban, saldo_inicial, notas) values
  ('11111111-0000-4000-8000-000000000001', 'Caixa', 'caixa', null, 350.00,
   'Dinheiro guardado no escritório'),
  ('11111111-0000-4000-8000-000000000002', 'CGD ...1234', 'banco',
   'PT50000000000000000001234', 12500.00, 'Conta principal do centro')
on conflict (id) do nothing;

-- --- Pessoas ----------------------------------------------------------------
insert into public.pessoas (id, nome, email, telefone, nif, perfil, notas) values
  ('22222222-0000-4000-8000-000000000001', 'Maria Figueira',
   'maria@quintadafigueira.pt', '912000001', '210000001', 'admin',
   'Gerência do centro'),
  ('22222222-0000-4000-8000-000000000002', 'Rui Antunes',
   'rui@quintadafigueira.pt', '912000002', '210000002', 'instrutor', null),
  ('22222222-0000-4000-8000-000000000003', 'Sónia Pais',
   'sonia@exemplo.pt', '912000003', '210000003', 'cliente',
   'Proprietária de dois cavalos a penso'),
  ('22222222-0000-4000-8000-000000000004', 'Tiago Lourenço',
   'tiago@exemplo.pt', '912000004', '210000004', 'cliente', null),
  ('22222222-0000-4000-8000-000000000005', 'Alberto Nunes',
   null, '912000005', null, 'tratador', 'Sem email, não usa a aplicação')
on conflict (id) do nothing;

insert into public.pessoa_papeis (pessoa_id, papel) values
  ('22222222-0000-4000-8000-000000000002', 'instrutor'),
  ('22222222-0000-4000-8000-000000000003', 'proprietario'),
  ('22222222-0000-4000-8000-000000000003', 'aluno'),
  ('22222222-0000-4000-8000-000000000004', 'proprietario'),
  ('22222222-0000-4000-8000-000000000004', 'jogador_horseball'),
  ('22222222-0000-4000-8000-000000000005', 'tratador')
on conflict do nothing;

-- --- Cavalos ----------------------------------------------------------------
insert into public.cavalos
  (id, nome, data_nascimento, sexo, raca, pelagem, regime, proprietario_id, notas)
values
  ('33333333-0000-4000-8000-000000000001', 'Fidalgo', '2015-04-12', 'castrado',
   'Lusitano', 'Ruço', 'penso', '22222222-0000-4000-8000-000000000003', null),
  ('33333333-0000-4000-8000-000000000002', 'Estrela', '2017-09-03', 'femea',
   'Cruzado', 'Castanho', 'penso', '22222222-0000-4000-8000-000000000003', null),
  ('33333333-0000-4000-8000-000000000003', 'Vento', '2013-01-20', 'macho',
   'PSL', 'Preto', 'penso', '22222222-0000-4000-8000-000000000004', null),
  ('33333333-0000-4000-8000-000000000004', 'Bolota', '2010-06-30', 'femea',
   'Pónei', 'Baio', 'escola', null, 'Cavalo de iniciação'),
  ('33333333-0000-4000-8000-000000000005', 'Trovão', '2012-11-11', 'castrado',
   'Lusitano', 'Baio', 'centro', null, 'Horseball')
on conflict (id) do nothing;

-- --- Boxes ------------------------------------------------------------------
insert into public.boxes (identificacao, zona, cavalo_id) values
  ('A1', 'Cavalariça A', '33333333-0000-4000-8000-000000000001'),
  ('A2', 'Cavalariça A', '33333333-0000-4000-8000-000000000002'),
  ('A3', 'Cavalariça A', null),
  ('B1', 'Cavalariça B', '33333333-0000-4000-8000-000000000003'),
  ('B2', 'Cavalariça B', '33333333-0000-4000-8000-000000000004'),
  ('B3', 'Cavalariça B', '33333333-0000-4000-8000-000000000005'),
  ('B4', 'Cavalariça B', null)
on conflict (identificacao) do nothing;

-- --- Contratos de penso -----------------------------------------------------
insert into public.contratos_penso
  (id, cavalo_id, cliente_id, valor_mensal, dia_vencimento, data_inicio)
values
  ('44444444-0000-4000-8000-000000000001',
   '33333333-0000-4000-8000-000000000001',
   '22222222-0000-4000-8000-000000000003', 280.00, 8, current_date - 200),
  ('44444444-0000-4000-8000-000000000002',
   '33333333-0000-4000-8000-000000000002',
   '22222222-0000-4000-8000-000000000003', 280.00, 8, current_date - 120),
  ('44444444-0000-4000-8000-000000000003',
   '33333333-0000-4000-8000-000000000003',
   '22222222-0000-4000-8000-000000000004', 310.00, 1, current_date - 60)
on conflict (id) do nothing;

-- --- Mensalidades do mês corrente -------------------------------------------
insert into public.mensalidades_penso (contrato_id, periodo, valor)
select ct.id, date_trunc('month', current_date)::date, ct.valor_mensal
  from public.contratos_penso ct
on conflict (contrato_id, periodo) do nothing;

-- --- Fornecedores -----------------------------------------------------------
insert into public.fornecedores (id, nome, nif, telefone) values
  ('55555555-0000-4000-8000-000000000001', 'Agro-Ribatejo, Lda.', '500000001', '243000001'),
  ('55555555-0000-4000-8000-000000000002', 'Clínica Veterinária Equina', '500000002', '243000002'),
  ('55555555-0000-4000-8000-000000000003', 'Ferrador João Dias', '200000003', '912000009')
on conflict (id) do nothing;

-- --- Despesas ---------------------------------------------------------------
insert into public.despesas
  (data, categoria_id, fornecedor_id, descricao, valor_total, taxa_iva,
   metodo_pagamento, conta_id, paga, cavalo_id)
select
  d.data, cat.id, d.fornecedor, d.descricao, d.valor, d.iva,
  d.metodo, d.conta, d.paga, d.cavalo
from (values
  (current_date - 12, 'racao',       '55555555-0000-4000-8000-000000000001'::uuid,
   'Ração — 20 sacos',            738.00, 6.00,  'transferencia'::public.metodo_pagamento,
   '11111111-0000-4000-8000-000000000002'::uuid, true,  null::uuid),
  (current_date - 10, 'palha',       '55555555-0000-4000-8000-000000000001'::uuid,
   'Palha — fardos grandes',      420.00, 6.00,  'transferencia'::public.metodo_pagamento,
   '11111111-0000-4000-8000-000000000002'::uuid, true,  null::uuid),
  (current_date - 8,  'veterinario', '55555555-0000-4000-8000-000000000002'::uuid,
   'Consulta — coxeira',          123.00, 23.00, 'mbway'::public.metodo_pagamento,
   '11111111-0000-4000-8000-000000000002'::uuid, true,
   '33333333-0000-4000-8000-000000000001'::uuid),
  (current_date - 5,  'ferrador',    '55555555-0000-4000-8000-000000000003'::uuid,
   'Ferração de 6 cavalos',       270.00, 23.00, 'dinheiro'::public.metodo_pagamento,
   '11111111-0000-4000-8000-000000000001'::uuid, true,  null::uuid),
  (current_date - 3,  'serradura',   '55555555-0000-4000-8000-000000000001'::uuid,
   'Serradura — camião',          615.00, 6.00,  'transferencia'::public.metodo_pagamento,
   '11111111-0000-4000-8000-000000000002'::uuid, false, null::uuid),
  (current_date - 2,  'combustivel', null::uuid,
   'Gasóleo do tractor',           98.40, 23.00, 'multibanco'::public.metodo_pagamento,
   '11111111-0000-4000-8000-000000000002'::uuid, true,  null::uuid)
) as d(data, slug, fornecedor, descricao, valor, iva, metodo, conta, paga, cavalo)
join public.categorias_despesa cat on cat.slug = d.slug;

-- --- Recebimentos -----------------------------------------------------------
-- Um dos três pensos do mês pago; os outros dois ficam por receber, para o
-- widget do dashboard ter conteúdo.
insert into public.recebimentos
  (data, pessoa_id, valor, metodo_pagamento, conta_id, tipo, mensalidade_id, periodo, descricao)
select
  current_date - 4,
  ct.cliente_id,
  m.valor,
  'transferencia',
  '11111111-0000-4000-8000-000000000002',
  'penso',
  m.id,
  m.periodo,
  'Penso ' || to_char(m.periodo, 'MM/YYYY')
from public.mensalidades_penso m
join public.contratos_penso ct on ct.id = m.contrato_id
where ct.id = '44444444-0000-4000-8000-000000000001'
  and m.periodo = date_trunc('month', current_date)::date;

insert into public.recebimentos
  (data, pessoa_id, valor, metodo_pagamento, conta_id, tipo, periodo, descricao)
values
  (current_date - 6, '22222222-0000-4000-8000-000000000004', 90.00, 'mbway',
   '11111111-0000-4000-8000-000000000002', 'aulas',
   date_trunc('month', current_date)::date, 'Pacote de 4 aulas');
