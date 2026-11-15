-- =============================================================================
-- Quem paga o ferrador: o centro, ou o próprio dono
-- =============================================================================
-- Na Quinta da Figueira há dois arranjos, e não um:
--
--   1. **O centro paga ao ferrador** e recobra ao cliente. Já funcionava: a
--      equipa regista a ferração e marca «pôr na conta do proprietário», que
--      cria o encargo.
--   2. **O dono trata directamente com o ferrador** e paga-lhe na hora. Este
--      não tinha onde viver. O centro pode nem saber que a visita aconteceu —
--      quem sabe é o dono —, e não há nada a cobrar a ninguém.
--
-- O arranjo é **do cavalo, e define-se uma vez** (`cavalos.ferrador_pago_por`),
-- em vez de se perguntar a cada ferração. Foi decisão do cliente, e segue o
-- que já estava escrito: «depende do cliente», não depende do dia.
--
-- Consequências, que são as que valem a pena:
--
-- * Num cavalo de `proprietario`, **o dono regista a ferração** — escreve o
--   nome do ferrador — e marca se já pagou. `pago_em` é dele, não do centro.
-- * Nesse caso o visto de «pôr na conta do proprietário» não aparece: não há
--   dinheiro do centro a recobrar, e oferecê-lo só criava enganos.
-- * Num cavalo de `centro` nada muda.

create type public.paga_ferrador as enum ('centro', 'proprietario');

alter table public.cavalos
  add column ferrador_pago_por public.paga_ferrador not null default 'centro';

comment on column public.cavalos.ferrador_pago_por is
  'Quem paga ao ferrador deste cavalo. `proprietario` deixa o dono registar a ferração e marcar que pagou.';

-- Data e não booleano: «pagou a 12/11» responde à pergunta seguinte sem
-- custar um campo a mais, porque quem marca está a marcar hoje.
alter table public.ferracoes
  add column pago_em date check (pago_em is null or pago_em <= current_date);

comment on column public.ferracoes.pago_em is
  'Quando o proprietário pagou ao ferrador. Só faz sentido nos cavalos em que é ele que paga; nos outros o dinheiro vive em `encargos`.';

-- --- RLS ---------------------------------------------------------------------
-- A equipa continua a poder tudo. O proprietário ganha escrita, e só nos
-- cavalos dele em que é ele que paga — fora disso a ferração é registo do
-- centro e ele continua só a ler.
--
-- **Sem `delete` para o proprietário, de propósito.** A ferração também
-- sustenta o calendário do ferrador do centro; apagá-la tirava ao tratador
-- uma linha de que ele depende. Um engano corrige-se editando.

create policy ferracoes_proprietario_regista on public.ferracoes
  for insert to authenticated
  with check (
    cavalo_id in (
      select c.id
        from public.cavalos c
       where c.proprietario_id = public.pessoa_actual_id()
         and c.ferrador_pago_por = 'proprietario'
    )
  );

create policy ferracoes_proprietario_corrige on public.ferracoes
  for update to authenticated
  using (
    cavalo_id in (
      select c.id
        from public.cavalos c
       where c.proprietario_id = public.pessoa_actual_id()
         and c.ferrador_pago_por = 'proprietario'
    )
  )
  with check (
    cavalo_id in (
      select c.id
        from public.cavalos c
       where c.proprietario_id = public.pessoa_actual_id()
         and c.ferrador_pago_por = 'proprietario'
    )
  );
