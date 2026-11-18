-- =============================================================================
-- NIF, morada e notas saem de `pessoas` para uma tabela à parte
-- =============================================================================
-- Pedido do centro: o instrutor e o tratador não precisam do NIF nem da
-- morada de toda a gente, nem das notas internas que a gestão escreve nas
-- fichas. Precisam do nome e do contacto, para telefonar sobre uma aula.
--
-- **Esconder isto na aplicação não chegava, e vale a pena ser claro porquê.**
-- A RLS decide **linhas, não colunas**: `pessoas_ler` deixa a equipa ler a
-- ficha, e a partir daí todas as colunas dela vêm no mesmo pedido. Deixar de
-- as pedir no `select` escondia-as do ecrã e de mais nada — qualquer pessoa
-- da equipa as ia buscar com o mesmo token. Privilégios por coluna no
-- Postgres são por **papel da base**, e no Supabase toda a gente autenticada
-- partilha o papel `authenticated`, por isso também não servem.
--
-- O que resta, e é o que a aplicação já faz noutro sítio pelo mesmo motivo, é
-- **mudar as colunas de tabela**: `calendarios` vive à parte de `pessoas`
-- precisamente porque a equipa lê `pessoas` inteira e não pode ler os tokens
-- dos outros. Isto é a mesma decisão, com os mesmos custos — mais uma tabela
-- e mais uma consulta em dois ou três ecrãs.
--
-- **Quem escreveu continua a ver o que é seu**: a própria pessoa lê a sua
-- linha. Escrever é da gestão.

create table public.pessoas_reservado (
  pessoa_id       uuid primary key
                    references public.pessoas (id) on delete cascade,
  nif             text check (nif is null or nif ~ '^[0-9]{9}$'),
  morada          text,
  notas           text,
  criado_em       timestamptz not null default now(),
  actualizado_em  timestamptz not null default now()
);

comment on table public.pessoas_reservado is
  'O que da ficha de uma pessoa é só da gestão: NIF, morada e notas internas. Vive à parte porque a RLS filtra linhas e não colunas, e a equipa lê `pessoas` inteira.';

create trigger pessoas_reservado_actualizado_em
  before update on public.pessoas_reservado
  for each row execute function public.tocar_actualizado_em();

-- O que já lá estava muda-se de sítio, e só se cria linha para quem tem
-- mesmo alguma coisa — não vale a pena uma linha vazia por cada ficha.
insert into public.pessoas_reservado (pessoa_id, nif, morada, notas)
select id, nif, morada, notas
  from public.pessoas
 where nif is not null or morada is not null or notas is not null;

alter table public.pessoas
  drop column nif,
  drop column morada,
  drop column notas;

-- --- RLS ---------------------------------------------------------------------
alter table public.pessoas_reservado enable row level security;

create policy pessoas_reservado_ler on public.pessoas_reservado
  for select to authenticated
  using (public.e_gestao() or pessoa_id = public.pessoa_actual_id());

create policy pessoas_reservado_gerir on public.pessoas_reservado
  for all to authenticated
  using (public.e_gestao())
  with check (public.e_gestao());
