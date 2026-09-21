-- =============================================================================
-- Raças e pelagens: listas escolhidas, e não texto livre
-- =============================================================================
-- `cavalos.raca` e `cavalos.pelagem` eram campos de texto, e com sessenta
-- cavalos a introduzir à mão o mesmo lusitano acabava escrito de quatro
-- maneiras — o que estraga a pesquisa e qualquer contagem por raça.
--
-- Esta tabela é a lista de opções que o formulário oferece. Não é uma chave
-- estrangeira de propósito: as colunas dos cavalos continuam a ser texto.
--   1. um cavalo que já esteja gravado com um valor fora da lista continua
--      válido, e a lista não tem de o conhecer para ele aparecer na ficha;
--   2. a pesquisa por `raca.ilike` continua a funcionar tal como está;
--   3. escrever uma raça nova é um INSERT nesta tabela, não uma migração.
--
-- A troco disso, mudar o nome de uma opção tem de mudar também os cavalos que
-- o usam. É o que `renomearOpcaoCavalo` faz, numa acção só.

create type public.tipo_opcao_cavalo as enum ('raca', 'pelagem');

create table public.opcoes_cavalo (
  id              uuid primary key default gen_random_uuid(),
  tipo            public.tipo_opcao_cavalo not null,
  valor           text not null check (length(btrim(valor)) > 0),
  -- As opções de origem vêm numeradas e ficam pela ordem escolhida; as
  -- acrescentadas depois ficam todas com 100 e ordenam-se alfabeticamente
  -- a seguir.
  ordem           smallint not null default 100,
  activa          boolean not null default true,
  criado_em       timestamptz not null default now(),
  actualizado_em  timestamptz not null default now()
);

-- «Lusitano» e «lusitano» são a mesma raça, e a lista não pode ter as duas.
create unique index opcoes_cavalo_tipo_valor_unico
  on public.opcoes_cavalo (tipo, lower(btrim(valor)));

create index opcoes_cavalo_tipo_idx
  on public.opcoes_cavalo (tipo, ordem, valor);

create trigger opcoes_cavalo_actualizado_em
  before update on public.opcoes_cavalo
  for each row execute function public.tocar_actualizado_em();

comment on table public.opcoes_cavalo is
  'Lista de raças e pelagens oferecida pelo formulário do cavalo. Não é chave estrangeira: cavalos.raca e cavalos.pelagem continuam a ser texto.';

-- Dados iniciais. Vão numa migração e não em seed.sql porque são dados de
-- referência de que a instalação de produção também precisa.
insert into public.opcoes_cavalo (tipo, valor, ordem) values
  ('raca', 'Árabe',                 10),
  ('raca', 'Anglo-Árabe',           20),
  ('raca', 'Cruzado Português',     30),
  ('raca', 'Lusitano',              40),
  ('raca', 'Luso-Árabe',            50),
  ('raca', 'Luso-Anglo-Árabe',      60),
  ('raca', 'PS Inglês',             70),
  ('raca', 'PS Irlandês',           80),
  ('pelagem', 'Apaloosa',           10),
  ('pelagem', 'Castanho',           20),
  ('pelagem', 'Isabel',             30),
  ('pelagem', 'Lazão',              40),
  ('pelagem', 'Malhado',            50),
  ('pelagem', 'Ruço',               60);

-- --- Segurança --------------------------------------------------------------
-- Toda a equipa lê (a lista aparece na ficha do cavalo), só a gestão escreve.
alter table public.opcoes_cavalo enable row level security;

create policy opcoes_cavalo_ler on public.opcoes_cavalo
  for select to authenticated
  using (true);

create policy opcoes_cavalo_gerir on public.opcoes_cavalo
  for all to authenticated
  using (public.e_gestao()) with check (public.e_gestao());
