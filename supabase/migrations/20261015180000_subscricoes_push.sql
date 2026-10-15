-- =============================================================================
-- Subscrições de notificação: um telemóvel que aceitou ser avisado
-- =============================================================================
-- Uma subscrição é a morada para onde o servidor manda a notificação, mais as
-- duas chaves com que a encripta. Quem a cria é o browser, quando a pessoa dá
-- autorização; a aplicação só a guarda.
--
-- **Isto é material sensível.** Com `endpoint`, `p256dh` e `auth` qualquer um
-- manda notificações para aquele telemóvel. Por isso a RLS é a mais apertada
-- da aplicação: cada pessoa vê e mexe nas suas, e mais ninguém — nem a gestão.
--
-- Quem precisa de ler as subscrições dos outros é só o envio, que corre no
-- servidor com uma chave privilegiada e fora do alcance de qualquer sessão.
-- Ver `lib/notificacoes/enviar.ts`.

create table public.subscricoes_push (
  id              uuid primary key default gen_random_uuid(),
  pessoa_id       uuid not null references public.pessoas (id) on delete cascade,
  -- A morada é única no mundo: o mesmo browser a subscrever outra vez
  -- devolve a mesma, e não deve criar linha nova.
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  -- Para a pessoa se reconhecer na lista: «iPhone de Marta», «Chrome».
  agente          text,
  criado_em       timestamptz not null default now(),
  -- Uma subscrição morta não se apaga à primeira: no iPhone falham por tudo
  -- e por nada. Três falhas seguidas é que a condenam.
  falhas          smallint not null default 0,
  ultima_falha_em timestamptz
);

comment on table public.subscricoes_push is
  'Moradas de notificação. Material sensível: com estas três colunas manda-se uma notificação para o telemóvel de alguém.';

create index subscricoes_push_por_pessoa on public.subscricoes_push (pessoa_id);

alter table public.subscricoes_push enable row level security;

-- Cada um com as suas, e só. Não há política para a gestão de propósito:
-- ninguém tem motivo para ler a morada do telemóvel de outra pessoa a partir
-- de uma sessão.
create policy subscricoes_push_proprias on public.subscricoes_push
  for all to authenticated
  using (pessoa_id = public.pessoa_actual_id())
  with check (pessoa_id = public.pessoa_actual_id());
