-- =============================================================================
-- «Vou» e «não vou»: o atleta responde à convocatória
-- =============================================================================
-- Quem é convocado sabe, melhor do que ninguém, se vai aparecer. Até aqui não
-- tinha onde o dizer: o instrutor convocava e ficava à espera de descobrir à
-- hora da aula, ou por WhatsApp.
--
-- **Confirmar não é estar presente, e as duas coisas não podem partilhar a
-- mesma coluna.** `estado` (convocado/presente/faltou/dispensado) é o que a
-- equipa regista **depois**, e é o registo de assiduidade do centro.
-- `confirmacao` é o que o atleta diz **antes**, e é uma intenção. Juntá-las
-- daria ao atleta a caneta para escrever a própria presença — e, do outro
-- lado, faria desaparecer a resposta dele no momento em que a equipa marcasse
-- as presenças.
--
-- É o mesmo desenho de `pagamentos_declarados`: o que a pessoa afirma vive ao
-- lado do que o centro regista, nunca por cima.
--
-- Deliberadamente, **dizer «não vou» não liberta o cavalo nem cancela nada**.
-- Quem decide se a aula se faz, e com que par aluno↔cavalo, é quem a dá. Isto
-- é informação a chegar a tempo, não uma desmarcação automática.

create type public.confirmacao_participante as enum (
  'sem_resposta',
  'vai',
  'nao_vai'
);

alter table public.evento_participantes
  add column confirmacao public.confirmacao_participante
    not null default 'sem_resposta',
  add column confirmado_em timestamptz,
  -- Opcional, e curto de propósito: ao instrutor interessa «estou doente» ou
  -- «estou fora», não um texto.
  add column motivo_ausencia text
    check (motivo_ausencia is null or length(btrim(motivo_ausencia)) between 1 and 200);

comment on column public.evento_participantes.confirmacao is
  'O que o atleta disse antes. NÃO é presença: essa é `estado`, e é escrita pela equipa depois.';

-- A pergunta do instrutor é «quem ainda não respondeu a este evento».
create index evento_participantes_por_confirmar
  on public.evento_participantes (evento_id)
  where confirmacao = 'sem_resposta';

-- --- O que o atleta pode mexer, e só isso --------------------------------
-- A RLS do Postgres decide linhas, não colunas: sem isto, deixar o atleta
-- responder à convocatória deixava-o também pôr-se a `presente` e trocar de
-- cavalo. A trigger devolve tudo o resto ao que estava.
--
-- Corre **antes** de `evento_participantes_preencher_periodo` (o nome
-- garante-o, por ordem alfabética), para a janela do cavalo ser recalculada a
-- partir do valor já reposto e não do que veio no pedido.

create or replace function public.carimbar_confirmacao_do_participante()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.confirmacao is distinct from old.confirmacao then
    new.confirmado_em := now();
  end if;

  -- `pg_trigger_depth() = 1` quer dizer «este UPDATE veio de fora», e não de
  -- outra trigger. É o que separa uma pessoa a editar a linha de uma cascata
  -- do sistema: cancelar um evento faz `propagar_janela_do_evento` anular a
  -- janela dos participantes, e sem esta condição o travão desfazia-o — o
  -- cavalo nunca mais ficava livre. `supabase/tests/02_eventos.sql` apanhou-o.
  if pg_trigger_depth() = 1 and not public.e_instrutor_ou_gestao() then
    new.evento_id := old.evento_id;
    new.pessoa_id := old.pessoa_id;
    new.cavalo_id := old.cavalo_id;
    new.estado    := old.estado;
    new.notas     := old.notas;
    new.periodo   := old.periodo;
  end if;

  return new;
end;
$$;

create trigger evento_participantes_carimbar_confirmacao
  before update on public.evento_participantes
  for each row execute function public.carimbar_confirmacao_do_participante();

-- --- RLS ---------------------------------------------------------------------
-- Uma política a mais, e nada retirado: as permissivas somam-se. Quem planeia
-- o dia continua a poder tudo; o atleta ganha o direito de responder, e a
-- trigger acima é que o limita à sua resposta.
--
-- Só `update`: convocar e desconvocar continuam a ser de quem planeia. Um
-- atleta que se desconvocasse a si próprio desaparecia da lista que o
-- instrutor leva para o picadeiro, e «não vou» tem de ficar à vista.

create policy evento_participantes_responder on public.evento_participantes
  for update to authenticated
  using (pessoa_id = public.pessoa_actual_id())
  with check (pessoa_id = public.pessoa_actual_id());
