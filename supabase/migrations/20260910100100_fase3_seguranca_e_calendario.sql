-- =============================================================================
-- Fase 3 — RLS dos eventos, e subscrição de calendário para o telemóvel
-- =============================================================================

-- --- Funções auxiliares -----------------------------------------------------

-- Quem planeia o dia: gestão e instrutores. Tratadores lêem, não escrevem.
create or replace function public.e_instrutor_ou_gestao()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    public.perfil_actual() in ('admin', 'gestor', 'instrutor'),
    false
  );
$$;

-- SECURITY DEFINER de propósito: uma política de evento_participantes que
-- consultasse evento_participantes entraria em recursão infinita.
create or replace function public.participo_no_evento(p_evento uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.evento_participantes ep
     where ep.evento_id = p_evento
       and ep.pessoa_id = public.pessoa_actual_id()
  );
$$;

create or replace function public.sou_membro_da_equipa(p_equipa uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.equipa_membros em
     where em.equipa_id = p_equipa
       and em.pessoa_id = public.pessoa_actual_id()
  );
$$;

grant execute on function
  public.e_instrutor_ou_gestao(),
  public.participo_no_evento(uuid),
  public.sou_membro_da_equipa(uuid)
to authenticated;

-- =============================================================================
-- Políticas
-- =============================================================================

alter table public.equipas              enable row level security;
alter table public.equipa_membros       enable row level security;
alter table public.eventos              enable row level security;
alter table public.evento_participantes enable row level security;
alter table public.avisos               enable row level security;

-- --- equipas ----------------------------------------------------------------
create policy equipas_ler on public.equipas
  for select to authenticated
  using (public.e_equipa() or public.sou_membro_da_equipa(id));

create policy equipas_gerir on public.equipas
  for all to authenticated
  using (public.e_instrutor_ou_gestao())
  with check (public.e_instrutor_ou_gestao());

create policy equipa_membros_ler on public.equipa_membros
  for select to authenticated
  using (public.e_equipa() or public.sou_membro_da_equipa(equipa_id));

create policy equipa_membros_gerir on public.equipa_membros
  for all to authenticated
  using (public.e_instrutor_ou_gestao())
  with check (public.e_instrutor_ou_gestao());

-- --- eventos ----------------------------------------------------------------
-- Um aluno ou jogador vê os eventos em que foi convocado, e mais nenhum.
create policy eventos_ler on public.eventos
  for select to authenticated
  using (
    public.e_equipa()
    or responsavel_id = public.pessoa_actual_id()
    or public.participo_no_evento(id)
  );

create policy eventos_gerir on public.eventos
  for all to authenticated
  using (public.e_instrutor_ou_gestao())
  with check (public.e_instrutor_ou_gestao());

-- --- evento_participantes ---------------------------------------------------
-- Quem está convocado vê os restantes convocados do mesmo evento: é preciso
-- para saber com quem se treina e que cavalos estão distribuídos.
create policy evento_participantes_ler on public.evento_participantes
  for select to authenticated
  using (
    public.e_equipa()
    or pessoa_id = public.pessoa_actual_id()
    or public.participo_no_evento(evento_id)
  );

create policy evento_participantes_gerir on public.evento_participantes
  for all to authenticated
  using (public.e_instrutor_ou_gestao())
  with check (public.e_instrutor_ou_gestao());

-- --- avisos -----------------------------------------------------------------
create policy avisos_ler on public.avisos
  for select to authenticated
  using (
    public.e_equipa()
    or (evento_id is not null and public.participo_no_evento(evento_id))
    or (equipa_id is not null and public.sou_membro_da_equipa(equipa_id))
  );

create policy avisos_gerir on public.avisos
  for all to authenticated
  using (public.e_instrutor_ou_gestao())
  with check (public.e_instrutor_ou_gestao());

-- =============================================================================
-- Subscrição de calendário
-- =============================================================================
-- Um endereço secreto por pessoa, que o telemóvel subscreve uma vez e passa a
-- actualizar sozinho. O leitor de calendário não sabe autenticar-se, por isso
-- o segredo vai no próprio endereço — daí viver numa tabela à parte, que nem a
-- equipa lê, e daí poder ser trocado a qualquer momento.
create table public.calendarios (
  pessoa_id  uuid primary key references public.pessoas (id) on delete cascade,
  token      uuid not null unique default gen_random_uuid(),
  criado_em  timestamptz not null default now()
);

alter table public.calendarios enable row level security;

-- Só o próprio, e os administradores para poderem desactivar um que vaze.
create policy calendarios_ler on public.calendarios
  for select to authenticated
  using (pessoa_id = public.pessoa_actual_id() or public.e_admin());

create policy calendarios_admin on public.calendarios
  for all to authenticated
  using (public.e_admin()) with check (public.e_admin());

/**
 * Devolve o token de calendário de quem está autenticado, criando-o se ainda
 * não existir. Trocar o token invalida imediatamente qualquer subscrição
 * antiga, que é o que se quer se o endereço for partilhado por engano.
 */
create or replace function public.obter_token_calendario(p_renovar boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pessoa uuid := public.pessoa_actual_id();
  v_token  uuid;
begin
  if v_pessoa is null then
    raise exception 'Sem sessão.' using errcode = '42501';
  end if;

  if p_renovar then
    insert into public.calendarios (pessoa_id) values (v_pessoa)
    on conflict (pessoa_id) do update set token = gen_random_uuid()
    returning token into v_token;
  else
    insert into public.calendarios (pessoa_id) values (v_pessoa)
    on conflict (pessoa_id) do update set pessoa_id = excluded.pessoa_id
    returning token into v_token;
  end if;

  return v_token;
end;
$$;

grant execute on function public.obter_token_calendario(boolean) to authenticated;

/**
 * Agenda de uma pessoa, para o ficheiro iCal. Autentica-se pelo token, porque
 * quem chama é a aplicação de calendário do telemóvel, sem sessão.
 *
 * Inclui os eventos em que a pessoa está convocada e aqueles de que é
 * responsável. Devolve também os cancelados: o calendário precisa de saber que
 * foram cancelados para os apagar de quem já os tinha.
 */
create or replace function public.agenda_por_token(p_token uuid)
returns table (
  id uuid,
  tipo public.tipo_evento,
  titulo text,
  data date,
  hora_inicio time,
  hora_fim time,
  local text,
  cancelado boolean,
  responsavel text,
  cavalo text,
  notas text,
  avisos text,
  actualizado_em timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with dono as (
    select c.pessoa_id
      from public.calendarios c
      join public.pessoas p on p.id = c.pessoa_id
     where c.token = p_token
       and p.activo
  ),
  meus as (
    select e.id as evento_id, ep.cavalo_id
      from dono
      join public.evento_participantes ep on ep.pessoa_id = dono.pessoa_id
      join public.eventos e on e.id = ep.evento_id
    union
    select e.id, null::uuid
      from dono
      join public.eventos e on e.responsavel_id = dono.pessoa_id
  )
  select
    e.id,
    e.tipo,
    e.titulo,
    e.data,
    e.hora_inicio,
    e.hora_fim,
    e.local,
    e.cancelado,
    r.nome,
    c.nome,
    e.notas,
    (
      select string_agg(a.texto, E'\n' order by a.criado_em)
        from public.avisos a
       where a.evento_id = e.id
    ),
    e.actualizado_em
  from meus
  join public.eventos e on e.id = meus.evento_id
  left join public.pessoas r on r.id = e.responsavel_id
  left join public.cavalos c on c.id = meus.cavalo_id
  -- Um calendário não precisa de história antiga; dois meses chegam para
  -- consultar o que passou sem inchar o ficheiro.
  where e.data >= current_date - 60
  order by e.data, e.hora_inicio;
$$;

grant execute on function public.agenda_por_token(uuid) to anon, authenticated;
