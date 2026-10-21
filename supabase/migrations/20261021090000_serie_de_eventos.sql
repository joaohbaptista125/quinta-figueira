-- =============================================================================
-- Séries: a aula de terça marcada uma vez, não oito
-- =============================================================================
-- Numa escola quase tudo é semanal, e marcar o mesmo de novo todas as semanas
-- era nove campos vezes oito. `serie_id` é só isto: as marcações nascidas da
-- mesma repetição partilham um id.
--
-- **Cada evento continua independente.** Cancelar o de 4 de Novembro não mexe
-- nos outros, mudar-lhe a hora não muda a dos outros, e a convocatória é de
-- cada um. A série não é um objecto com vida própria — é uma etiqueta que
-- permite perguntar «e os seguintes?» quando faz jeito, e nada mais.
--
-- Deliberadamente **não há tabela de séries**: um evento que perca os irmãos
-- continua um evento válido, e nunca é preciso ir buscar a série para desenhar
-- a agenda.

alter table public.eventos
  add column serie_id uuid;

comment on column public.eventos.serie_id is
  'Marcações nascidas da mesma repetição semanal. Null quando o evento foi marcado sozinho. Cada evento é independente — isto é uma etiqueta, não um dono.';

-- A pergunta é sempre «os outros desta série, a partir desta data».
create index eventos_por_serie on public.eventos (serie_id, data)
  where serie_id is not null;
