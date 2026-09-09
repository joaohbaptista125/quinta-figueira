-- =============================================================================
-- Segurança: funções auxiliares, RLS em todas as tabelas, Storage
-- =============================================================================
-- Princípios:
--   * RLS activa em TODAS as tabelas de public. Nada é lido sem política.
--   * As funções auxiliares são SECURITY DEFINER de propósito: correm como dono
--     e por isso ignoram a RLS de public.pessoas, evitando recursão infinita
--     quando são usadas dentro das políticas dessa própria tabela.
--   * O financeiro (contas, categorias, fornecedores, despesas) é exclusivo de
--     admin/gestor. Um cliente vê apenas o que lhe diz respeito.
-- =============================================================================

-- --- Funções auxiliares -----------------------------------------------------

create or replace function public.pessoa_actual_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id
    from public.pessoas
   where auth_user_id = auth.uid()
     and activo
   limit 1;
$$;

create or replace function public.perfil_actual()
returns public.perfil_acesso
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select perfil
    from public.pessoas
   where auth_user_id = auth.uid()
     and activo
   limit 1;
$$;

-- admin ou gestor: acesso total, incluindo financeiro.
create or replace function public.e_gestao()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.perfil_actual() in ('admin', 'gestor'), false);
$$;

-- Pessoal do centro: vê cadastro (pessoas, cavalos, boxes) mas não o financeiro.
create or replace function public.e_equipa()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    public.perfil_actual() in ('admin', 'gestor', 'instrutor', 'tratador'),
    false
  );
$$;

create or replace function public.e_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.perfil_actual() = 'admin', false);
$$;

grant execute on function
  public.pessoa_actual_id(),
  public.perfil_actual(),
  public.e_gestao(),
  public.e_equipa(),
  public.e_admin()
to authenticated;

-- --- Ligação automática entre auth.users e pessoas --------------------------
-- Fluxo previsto: a gestão regista as ~80 pessoas com o respectivo email e só
-- depois as convida pelo Supabase Auth. Quando o utilizador aparece em
-- auth.users, esta trigger liga-o à ficha existente e dá-lhe perfil 'cliente'
-- por omissão (a gestão pode promovê-lo depois).
create or replace function public.ligar_pessoa_a_novo_utilizador()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is null then
    return new;
  end if;

  update public.pessoas
     set auth_user_id   = new.id,
         perfil         = coalesce(perfil, 'cliente'),
         actualizado_em = now()
   where auth_user_id is null
     and email is not null
     and lower(email) = lower(new.email);

  return new;
end;
$$;

create trigger ligar_pessoa_ao_criar_utilizador
  after insert on auth.users
  for each row execute function public.ligar_pessoa_a_novo_utilizador();

-- --- Arranque: reclamar o primeiro administrador ----------------------------
-- Sem isto o sistema fica trancado: as políticas de escrita exigem um gestor e
-- de início não existe nenhum. Só funciona enquanto não houver admin.
create or replace function public.reclamar_primeiro_admin(p_nome text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id    uuid;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar autenticado.' using errcode = '42501';
  end if;

  if exists (select 1 from public.pessoas where perfil = 'admin' and activo) then
    raise exception 'Já existe um administrador. Peça-lhe que crie a sua conta.'
      using errcode = '42501';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  update public.pessoas
     set perfil = 'admin', activo = true, actualizado_em = now()
   where auth_user_id = auth.uid()
  returning id into v_id;

  if v_id is null then
    insert into public.pessoas (nome, email, auth_user_id, perfil)
    values (coalesce(nullif(btrim(p_nome), ''), v_email, 'Administrador'),
            v_email, auth.uid(), 'admin')
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

grant execute on function public.reclamar_primeiro_admin(text) to authenticated;

-- Permite à página de arranque saber se ainda falta criar o primeiro admin,
-- sem expor a tabela pessoas a quem ainda não tem perfil.
create or replace function public.existe_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.pessoas where perfil = 'admin' and activo);
$$;

grant execute on function public.existe_admin() to authenticated, anon;

-- =============================================================================
-- Políticas RLS
-- =============================================================================

alter table public.pessoas             enable row level security;
alter table public.pessoa_papeis       enable row level security;
alter table public.cavalos             enable row level security;
alter table public.boxes               enable row level security;
alter table public.contratos_penso     enable row level security;
alter table public.contas              enable row level security;
alter table public.categorias_despesa  enable row level security;
alter table public.fornecedores        enable row level security;
alter table public.despesas            enable row level security;
alter table public.mensalidades_penso  enable row level security;
alter table public.recebimentos        enable row level security;

-- --- pessoas ----------------------------------------------------------------
create policy pessoas_ler on public.pessoas
  for select to authenticated
  using (public.e_equipa() or id = public.pessoa_actual_id());

create policy pessoas_gerir on public.pessoas
  for all to authenticated
  using (public.e_gestao())
  with check (public.e_gestao());

-- --- pessoa_papeis ----------------------------------------------------------
create policy pessoa_papeis_ler on public.pessoa_papeis
  for select to authenticated
  using (public.e_equipa() or pessoa_id = public.pessoa_actual_id());

create policy pessoa_papeis_gerir on public.pessoa_papeis
  for all to authenticated
  using (public.e_gestao())
  with check (public.e_gestao());

-- --- cavalos ----------------------------------------------------------------
-- Um cliente vê apenas os cavalos de que é proprietário.
create policy cavalos_ler on public.cavalos
  for select to authenticated
  using (public.e_equipa() or proprietario_id = public.pessoa_actual_id());

create policy cavalos_gerir on public.cavalos
  for all to authenticated
  using (public.e_gestao())
  with check (public.e_gestao());

-- --- boxes ------------------------------------------------------------------
create policy boxes_ler on public.boxes
  for select to authenticated
  using (
    public.e_equipa()
    or cavalo_id in (
      select c.id from public.cavalos c
       where c.proprietario_id = public.pessoa_actual_id()
    )
  );

create policy boxes_gerir on public.boxes
  for all to authenticated
  using (public.e_gestao())
  with check (public.e_gestao());

-- --- contratos_penso --------------------------------------------------------
-- Contém valores: fora do alcance de instrutores e tratadores.
create policy contratos_penso_ler on public.contratos_penso
  for select to authenticated
  using (public.e_gestao() or cliente_id = public.pessoa_actual_id());

create policy contratos_penso_gerir on public.contratos_penso
  for all to authenticated
  using (public.e_gestao())
  with check (public.e_gestao());

-- --- Financeiro estrito: só admin/gestor ------------------------------------
create policy contas_gestao on public.contas
  for all to authenticated
  using (public.e_gestao()) with check (public.e_gestao());

create policy categorias_despesa_gestao on public.categorias_despesa
  for all to authenticated
  using (public.e_gestao()) with check (public.e_gestao());

create policy fornecedores_gestao on public.fornecedores
  for all to authenticated
  using (public.e_gestao()) with check (public.e_gestao());

create policy despesas_gestao on public.despesas
  for all to authenticated
  using (public.e_gestao()) with check (public.e_gestao());

-- --- mensalidades_penso -----------------------------------------------------
create policy mensalidades_ler on public.mensalidades_penso
  for select to authenticated
  using (
    public.e_gestao()
    or contrato_id in (
      select ct.id from public.contratos_penso ct
       where ct.cliente_id = public.pessoa_actual_id()
    )
  );

create policy mensalidades_gerir on public.mensalidades_penso
  for all to authenticated
  using (public.e_gestao()) with check (public.e_gestao());

-- --- recebimentos -----------------------------------------------------------
create policy recebimentos_ler on public.recebimentos
  for select to authenticated
  using (public.e_gestao() or pessoa_id = public.pessoa_actual_id());

create policy recebimentos_gerir on public.recebimentos
  for all to authenticated
  using (public.e_gestao()) with check (public.e_gestao());

-- =============================================================================
-- Storage
-- =============================================================================
-- Dois buckets privados. O acesso aos ficheiros faz-se por URL assinado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('cavalos', 'cavalos', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('documentos', 'documentos', false, 20971520,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

-- Fotos de cavalos: legíveis por qualquer utilizador autenticado (o caminho só
-- é conhecido a partir da ficha do cavalo, que já é filtrada por RLS).
create policy "fotos_cavalos_ler" on storage.objects
  for select to authenticated
  using (bucket_id = 'cavalos');

create policy "fotos_cavalos_gerir" on storage.objects
  for all to authenticated
  using (bucket_id = 'cavalos' and public.e_gestao())
  with check (bucket_id = 'cavalos' and public.e_gestao());

-- Faturas digitalizadas: estritamente financeiro.
create policy "documentos_gestao" on storage.objects
  for all to authenticated
  using (bucket_id = 'documentos' and public.e_gestao())
  with check (bucket_id = 'documentos' and public.e_gestao());
