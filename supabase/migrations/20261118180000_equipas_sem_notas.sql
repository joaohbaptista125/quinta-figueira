-- =============================================================================
-- As notas da equipa saem, porque o Chat ocupou o lugar delas
-- =============================================================================
-- Pedido do centro, a seguir ao Chat ficar a funcionar: `equipas.notas` era
-- uma caixa de texto no formulário da equipa — **uma só, que se reescrevia por
-- cima** e que ninguém sabia quem tinha escrito nem quando. O Chat faz o mesmo
-- trabalho melhor: cada mensagem tem autor, data, e fica.
--
-- **Isto apaga o que lá estiver escrito, e é de propósito** — como o
-- `drop table boxes` na migração dos paddocks. Fica registado que foi decisão
-- e não descuido. Se alguma equipa tinha alguma coisa escrita nesse campo,
-- perdeu-se aqui; o que se escrever a partir de agora vive no Chat, que é
-- `avisos` com `equipa_id`.
--
-- Não confundir com `notas_cavalo`, que é outra coisa e fica: essa é o caderno
-- de um cavalo, com autor e histórico, e não um campo de texto solto.

alter table public.equipas drop column notas;
