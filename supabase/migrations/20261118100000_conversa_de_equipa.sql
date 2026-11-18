-- =============================================================================
-- A conversa da equipa: os membros passam a escrever, e o autor é carimbado
-- =============================================================================
-- Pedido explícito do centro, e vale a pena registar que **contraria uma
-- decisão anterior** — a de não haver conversa nenhuma na aplicação. O motivo
-- de então continua de pé e é o que molda isto: um sítio para escrever sem
-- avisos fiáveis fica deserto, com as conversas a voltarem para o WhatsApp.
-- Por isso esta migração anda a par com as notificações em `guardarAviso`:
-- **sem elas não valia a pena abrir a escrita.**
--
-- O que muda, e o que fica como estava:
--
--   * **Só nas equipas.** Um aviso de evento continua a ser de um para
--     muitos: quem planeia escreve, quem foi convocado lê. Numa equipa é
--     outra coisa — é um grupo que existe para falar entre si.
--   * **Escrever, sim; apagar, não.** É a regra de `notas_cavalo`, e pela
--     mesma razão: uma conversa reescrita depois do facto não serve de
--     registo. Só a gestão e os instrutores apagam, para o caso de alguém
--     escrever o que não devia.
--   * **O autor passa a ser carimbado pela base.** Até aqui era a aplicação
--     que dizia quem tinha escrito. Enquanto só a gestão escrevia isso era
--     pouco interessante; com os membros a escrever, era deixar a aplicação
--     falar em nome de outro.

-- --- Os membros escrevem na conversa da sua equipa ---------------------------
-- `avisos_gerir` (e_instrutor_ou_gestao) fica como está e continua a cobrir
-- tudo o resto. Esta acrescenta-se, e as políticas permissivas somam-se.
create policy avisos_conversa_da_equipa on public.avisos
  for insert to authenticated
  with check (
    equipa_id is not null
    and evento_id is null
    and public.sou_membro_da_equipa(equipa_id)
  );

-- --- Quem escreveu é a base que diz -----------------------------------------
create or replace function public.carimbar_autor_do_aviso()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Sem sessão (seed, migrações) fica o que vier — é a mesma excepção de
  -- `carimbar_cavalo_proposto`, e sem ela o seed não conseguia escrever um
  -- aviso em nome de ninguém.
  if public.pessoa_actual_id() is null then
    return new;
  end if;

  new.autor_id := public.pessoa_actual_id();
  return new;
end;
$$;

create trigger avisos_carimbar_autor
  before insert on public.avisos
  for each row execute function public.carimbar_autor_do_aviso();

comment on function public.carimbar_autor_do_aviso() is
  'Quem escreveu um aviso é a base que diz, não a aplicação — desde que os membros da equipa passaram a poder escrever.';
