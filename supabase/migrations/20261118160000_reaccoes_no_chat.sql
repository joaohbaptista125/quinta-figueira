-- =============================================================================
-- Reagir a uma mensagem do chat da equipa
-- =============================================================================
-- Pedido do centro, a seguir à conversa da equipa: poder responder a uma
-- mensagem com um emoji, dos mais comuns.
--
-- **O que isto resolve não é decoração.** Numa conversa de equipa a resposta
-- mais frequente é «li e concordo», e escrevê-la são cinco mensagens de «ok» a
-- empurrar a conversa para cima — e, pior, **cinco notificações** no telemóvel
-- de toda a gente. Uma reacção diz o mesmo sem nada disso.
--
-- Três decisões, e o motivo de cada uma:
--
--   * **Uma reacção não avisa ninguém.** É a regra de `recolher` nos paddocks
--     e do aviso de mensalidade: o que não é urgente não interrompe. Um
--     polegar a gerar uma notificação era a maneira mais rápida de estes
--     avisos passarem a ser ignorados — e são eles que fazem a conversa
--     funcionar, porque não há tempo real.
--   * **A reacção tira-se, ao contrário da mensagem.** «Ninguém reescreve o
--     que já foi dito» vale para o que foi dito; uma reacção é um interruptor,
--     e um engano corrige-se no próprio gesto. Daí haver `delete`, e só da
--     própria.
--   * **Quem reagiu é a base que diz**, como o autor do aviso e o da nota.
--
-- O emoji é `text` e não um enumerado, pelo mesmo motivo das raças: a lista
-- oferecida vive na aplicação (`EMOJIS_COMUNS`), e acrescentar um emoji não
-- deve ser uma migração. O `check` só trava o que não é um emoji — um texto
-- inteiro disfarçado de reacção.

create table public.aviso_reaccoes (
  aviso_id   uuid not null references public.avisos (id)  on delete cascade,
  pessoa_id  uuid not null references public.pessoas (id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 8),
  criado_em  timestamptz not null default now(),
  primary key (aviso_id, pessoa_id, emoji)
);

comment on table public.aviso_reaccoes is
  'Reacções com emoji às mensagens do chat. A chave primária faz com que a mesma pessoa não reaja duas vezes com o mesmo emoji — é o que torna o botão um interruptor.';

create index aviso_reaccoes_por_aviso on public.aviso_reaccoes (aviso_id);

-- --- Quem reagiu é a base que diz -------------------------------------------
create or replace function public.carimbar_autor_da_reaccao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Sem sessão (seed, migrações) fica o que vier, como nas outras.
  if public.pessoa_actual_id() is null then
    return new;
  end if;

  new.pessoa_id := public.pessoa_actual_id();
  return new;
end;
$$;

create trigger aviso_reaccoes_carimbar_autor
  before insert on public.aviso_reaccoes
  for each row execute function public.carimbar_autor_da_reaccao();

comment on function public.carimbar_autor_da_reaccao() is
  'Quem reagiu é a base que diz, não a aplicação — a mesma regra do autor do aviso e da nota do cavalo.';

-- --- RLS ---------------------------------------------------------------------
alter table public.aviso_reaccoes enable row level security;

-- **A fronteira é a do próprio aviso, e não é preciso repeti-la.** Um
-- `exists` sobre `avisos` dentro de uma política corre com a identidade de
-- quem consulta, por isso a RLS de `avisos` aplica-se lá dentro: quem não lê a
-- mensagem não vê as reacções dela, nem lhe pode reagir. Repetir aqui as
-- condições de `avisos_ler` era deixar duas regras para andarem a divergir.
create policy aviso_reaccoes_ler on public.aviso_reaccoes
  for select to authenticated
  using (exists (select 1 from public.avisos a where a.id = aviso_id));

create policy aviso_reaccoes_reagir on public.aviso_reaccoes
  for insert to authenticated
  with check (
    pessoa_id = public.pessoa_actual_id()
    and exists (select 1 from public.avisos a where a.id = aviso_id)
  );

-- Só a própria, e nem a gestão: apagar a reacção de outra pessoa é falar em
-- nome dela. Uma mensagem imprópria apaga-se inteira, e as reacções vão com
-- ela pelo `on delete cascade`.
create policy aviso_reaccoes_retirar on public.aviso_reaccoes
  for delete to authenticated
  using (pessoa_id = public.pessoa_actual_id());
