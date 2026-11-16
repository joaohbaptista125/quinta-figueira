-- =============================================================================
-- O cliente propõe o cavalo; a gestão aprova
-- =============================================================================
-- Dá-se o acesso ao cliente antes de a ficha do cavalo existir — é o que
-- acontece quando alguém chega ao centro. Até aqui ele entrava e não tinha
-- nada para ver, e a ficha ficava à espera de alguém da gestão ter tempo.
-- Agora inscreve o cavalo no momento, e o que ele escreve fica **por
-- aprovar** até a gestão o confirmar.
--
-- Decisões, e porquê:
--
-- * **É uma data e não um estado.** `aprovado_em` responde «está aprovado?» e
--   «desde quando?» com uma coluna só, e não precisa de enumerado nem de
--   valores de transição. É o desenho de `pessoas.acesso_confirmado_em` e de
--   `ferracoes.pago_em`, e vale aqui pela mesma razão.
-- * **Não há estado «recusado».** Uma proposta que não serve é apagada, com
--   o motivo a chegar ao cliente pela notificação — ver `recusarCavalo` em
--   `lib/accoes/cavalos.ts`. Guardar fichas recusadas enchia a listagem de
--   cavalos que não existem no centro.
-- * **A RLS decide linhas, não colunas**, e aqui era preciso travar colunas:
--   um cliente que pudesse pôr `aprovado_em` aprovava-se a si próprio, e um
--   que pudesse escolher `proprietario_id` inscrevia um cavalo em nome de
--   outro. Quem o limita é a trigger `carimbar_cavalo_proposto`, como em
--   `carimbar_confirmacao_do_participante` e em `carimbar_autor_da_nota`.
-- * **Sem sessão, nada disto se aplica.** O seed e as migrações correm sem
--   `pessoa_actual_id()`, e aí a ficha nasce aprovada — senão o seed partia
--   contra `cavalos_penso_exige_proprietario`.

-- `aprovado_por` e `criado_por_id` são `uuid` sem chave estrangeira, e isso é
-- deliberado: `cavalos.proprietario_id` já aponta para `pessoas`, e uma
-- segunda ou terceira referência para a mesma tabela torna `pessoas(...)`
-- ambíguo no PostgREST — todos os `select` aninhados da ficha e da listagem
-- deixariam de resolver, e passariam a precisar do nome da restrição à frente.
-- São carimbos de auditoria: o que interessa é quem foi, e uma ficha de
-- pessoa quase nunca se apaga (a aplicação recusa quando tem coisas presas).
alter table public.cavalos
  add column aprovado_em    timestamptz,
  add column aprovado_por   uuid,
  add column criado_por_id  uuid;

comment on column public.cavalos.aprovado_em is
  'Quando a gestão confirmou a ficha. A null = proposta do cliente, por aprovar.';
comment on column public.cavalos.criado_por_id is
  'Quem inscreveu o cavalo. É a quem chega o aviso da decisão.';

-- Tudo o que já existe foi escrito pela gestão: nasce aprovado, com a data em
-- que foi criado. Sem isto, a aplicação acordava com sessenta cavalos por
-- aprovar.
update public.cavalos set aprovado_em = criado_em where aprovado_em is null;

-- A pergunta do painel é sempre «o que falta aprovar».
create index cavalos_por_aprovar
  on public.cavalos (criado_em desc)
  where aprovado_em is null;

-- --- A trigger que limita as colunas ------------------------------------------
create or replace function public.carimbar_cavalo_proposto()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_pessoa uuid;
begin
  v_pessoa := public.pessoa_actual_id();

  if tg_op = 'INSERT' then
    -- Sem sessão (seed, migrações) ou com a gestão a escrever: nasce aprovado.
    if v_pessoa is null or public.e_gestao() then
      new.aprovado_em   := coalesce(new.aprovado_em, now());
      new.aprovado_por  := coalesce(new.aprovado_por, v_pessoa);
      new.criado_por_id := coalesce(new.criado_por_id, v_pessoa);
      return new;
    end if;

    -- Proposta: o cavalo é de quem o inscreve, a penso, e por aprovar.
    -- `regime` e `proprietario_id` são forçados e não lidos do formulário —
    -- o regime diz de quem é o cavalo, e isso não é do cliente.
    new.criado_por_id   := v_pessoa;
    new.proprietario_id := v_pessoa;
    new.regime          := 'penso';
    new.activo          := true;
    new.aprovado_em     := null;
    new.aprovado_por    := null;
    return new;
  end if;

  -- Numa correcção do próprio cliente, só mudam os campos descritivos. Sem
  -- isto, corrigir o nome do cavalo era a ocasião para se aprovar sozinho.
  --
  -- `pg_trigger_depth() = 1` pela mesma razão que em
  -- `carimbar_confirmacao_do_participante`: uma escrita em cascata não é o
  -- cliente a escrever, e travá-la desfazia o que outra trigger acabou de
  -- fazer.
  if v_pessoa is not null and not public.e_gestao() and pg_trigger_depth() = 1 then
    new.criado_por_id   := old.criado_por_id;
    new.proprietario_id := old.proprietario_id;
    new.regime          := old.regime;
    new.activo          := old.activo;
    new.aprovado_em     := old.aprovado_em;
    new.aprovado_por    := old.aprovado_por;
  end if;

  return new;
end $$;

create trigger cavalos_carimbar_proposta
  before insert or update on public.cavalos
  for each row execute function public.carimbar_cavalo_proposto();

-- --- RLS ----------------------------------------------------------------------
-- `cavalos_ler` e `cavalos_gerir` ficam como estavam. Acrescentam-se três
-- políticas, todas presas ao mesmo par de condições: o cavalo é do próprio, e
-- ainda não foi aprovado.
--
-- Depois de aprovado o cliente deixa de escrever: a correcção passa a ser uma
-- nota na ficha, que é o caminho que já existe e que deixa rasto.

create policy cavalos_propor on public.cavalos
  for insert to authenticated
  with check (proprietario_id = public.pessoa_actual_id());

create policy cavalos_corrigir_proposta on public.cavalos
  for update to authenticated
  using (
    proprietario_id = public.pessoa_actual_id() and aprovado_em is null
  )
  with check (
    proprietario_id = public.pessoa_actual_id() and aprovado_em is null
  );

-- Apagar a própria proposta enquanto ninguém decidiu: é o «enganei-me» de
-- quem acabou de escrever, e não há nada pendurado numa ficha por aprovar.
create policy cavalos_apagar_proposta on public.cavalos
  for delete to authenticated
  using (
    proprietario_id = public.pessoa_actual_id() and aprovado_em is null
  );
