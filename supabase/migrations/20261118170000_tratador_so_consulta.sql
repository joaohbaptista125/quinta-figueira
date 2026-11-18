-- =============================================================================
-- O tratador passa a consultar, e deixa de escrever
-- =============================================================================
-- Pedido explícito do centro, e **contraria duas decisões registadas** — por
-- isso fica aqui escrito o que elas diziam, para quem vier a seguir não julgar
-- que foi descuido.
--
-- O que estava escrito, e porquê:
--
--   * nos paddocks, «escrever é de `e_equipa()` — quem larga os cavalos é o
--     tratador»;
--   * nas ferrações, «escrever é de `e_equipa()` e não só da gestão — quem
--     recebe o ferrador na cavalariça é o tratador, e obrigá-lo a pedir à
--     gestão era a maneira certa de o registo não existir».
--
-- O risco continua a ser esse, e não desapareceu por a regra ter mudado: se o
-- quadro dos paddocks deixar de ser preenchido de manhã, ou se as ferrações
-- deixarem de ser lançadas, **é aqui que se vem ver porquê**. O centro
-- decidiu que o perfil de tratador é de consulta, e é o que fica.
--
-- Quem escreve passa a ser `e_instrutor_ou_gestao()` — a gestão e o
-- instrutor, que são quem planeia o dia. Não é `e_gestao()`: alguém que
-- esteja na cavalariça tem de poder lançar o que lá acontece.
--
-- **Ler não muda.** O tratador continua a ver o quadro dos paddocks, o
-- calendário e o histórico de ferração de cada cavalo — é para isso que entra
-- na aplicação. O resto do calendário já era de `e_instrutor_ou_gestao()`
-- (eventos, convocatórias, presenças e avisos de evento), por isso não há nada
-- a mudar aí.
--
-- **O que fica de fora, e de propósito:** `notas_cavalo`. Não é registo do
-- centro, é a conversa de um cavalo — o dono pergunta e a cavalariça
-- responde. Fechá-la ao tratador tirava a resposta a quem muitas vezes é o
-- único que sabe dar. O mesmo vale para o chat de equipa, que depende de ser
-- membro e não do perfil.

-- --- Paddocks ---------------------------------------------------------------
drop policy paddock_ocupacao_gerir on public.paddock_ocupacao;

create policy paddock_ocupacao_gerir on public.paddock_ocupacao
  for all to authenticated
  using (public.e_instrutor_ou_gestao())
  with check (public.e_instrutor_ou_gestao());

-- --- Ferrações --------------------------------------------------------------
-- `ferracoes_ler` fica como está (`e_equipa()` mais o dono): o tratador lê o
-- histórico, e o dono o dos cavalos dele.
--
-- As duas políticas do proprietário (`ferracoes_proprietario_regista` e
-- `…_corrige`) também ficam: nos cavalos em que é ele que paga ao ferrador, é
-- ele que regista a visita, e isso não tem nada que ver com o perfil.
drop policy ferracoes_gerir on public.ferracoes;

create policy ferracoes_gerir on public.ferracoes
  for all to authenticated
  using (public.e_instrutor_ou_gestao())
  with check (public.e_instrutor_ou_gestao());
