# Quinta da Figueira — notas para sessões futuras

Aplicação de gestão de um centro hípico. **Um único centro** — não é multi-tenant
e não deve ser construída como tal. Escala real: ~60 cavalos, ~80 pessoas.

Toda a interface está em **português de Portugal**: moeda EUR, datas DD/MM/AAAA,
ortografia pré-acordo nas palavras em que o código já a usa (`actualizar`,
`activo`, `directo`, `acção`). Nomes de tabelas, colunas, ficheiros, funções e
variáveis também estão em português. Mantém a coerência.

---

## 1. Regra crítica: esta aplicação NÃO emite documentos fiscais

Em Portugal, faturas e recibos têm de ser emitidos por **software certificado
pela AT**. Nunca implementes emissão de faturas, recibos, notas de crédito,
séries de documentos, comunicação de séries, SAF-T ou assinatura de documentos.

O que a aplicação faz é registar **movimentos de dinheiro**: quem pagou o quê,
quando, por que método e para que conta.

A ligação ao documento fiscal está prevista, mas por integração externa
(Vendus / InvoiceXpress / Moloni). Os campos já existem em `recebimentos`:

- `documento_fiscal_ref` — número do documento emitido lá fora
- `documento_fiscal_url` — link para o PDF
- `documento_fiscal_emitido_em` — quando foi emitido

Hoje `documento_fiscal_ref` é preenchido à mão no formulário. A integração por
API é trabalho futuro; não a inventes sem pedido explícito.

---

## 2. Stack

| Camada | Escolha |
|---|---|
| Aplicação | Next.js 15 (App Router) + TypeScript |
| Estilo | Tailwind CSS v4 + kit de componentes próprio em `components/ui/` (estilo shadcn: o código vive no repositório) |
| Base de dados / Auth / Storage | Supabase |
| Alojamento | Vercel |
| Mutações | Server Actions (`lib/accoes/`), sem rotas de API |

Sem biblioteca de gestão de estado, sem cliente de dados, sem ORM. As páginas
são Server Components que consultam o Supabase directamente.

---

## 3. Modelo de dados

Migrações versionadas em `supabase/migrations/`, por ordem:

| Ficheiro | Conteúdo |
|---|---|
| `…090000_base_tipos_e_utilitarios.sql` | extensão `btree_gist`, tipos enumerados, trigger `tocar_actualizado_em` |
| `…090100_fase1_cadastro.sql` | `pessoas`, `pessoa_papeis`, `cavalos`, `boxes`, `contratos_penso` |
| `…090200_fase2_financeiro.sql` | `contas`, `categorias_despesa` (+ seed), `fornecedores`, `despesas`, `mensalidades_penso`, `recebimentos` |
| `…090300_seguranca_rls.sql` | funções auxiliares, RLS de todas as tabelas, buckets de Storage |
| `…090400_funcoes_e_vistas.sql` | `gerar_mensalidades`, sincronização de mensalidades, as 4 vistas |
| `…100000_fase3_eventos.sql` | `equipas`, `equipa_membros`, `eventos`, `evento_participantes`, `avisos` |
| `…100100_fase3_seguranca_e_calendario.sql` | RLS da Fase 3, `calendarios`, `agenda_por_token` |
| `…110000_opcoes_de_cavalo.sql` | `opcoes_cavalo` — lista de raças e pelagens (+ seed) |
| `…20261010090000_convite_de_acesso.sql` | `pessoas.convidado_em` |
| `…20261010103000_acesso_confirmado.sql` | `pessoas.acesso_confirmado_em` + trigger de entrada |
| `…20261015120000_ferracoes.sql` | `ferracoes` + `v_ferracao_cavalos` |
| `…20261015140000_encargos.sql` | `encargos` + `recebimentos.encargo_id` + `v_encargos_por_receber` |
| `…20261015160000_notas_cavalo.sql` | `notas_cavalo` + `v_notas_por_responder` |
| `…20261015180000_subscricoes_push.sql` | `subscricoes_push` |
| `…20261021090000_serie_de_eventos.sql` | `eventos.serie_id` |
| `…20261021110000_pagamentos_declarados.sql` | `pagamentos_declarados` + `confirmar_pagamento_declarado` + `v_pagamentos_por_confirmar` |

**Nunca alteres o esquema pelo painel do Supabase.** Cria uma migração nova e
actualiza `lib/tipos-bd.ts` na mesma alteração.

**As migrações aplicam-se sozinhas** pelo workflow `.github/workflows/migracoes.yml`:
entra uma migração no `main`, corre `supabase db push`. Fica em silêncio
enquanto os segredos do repositório não estiverem configurados — as
instruções estão no cabeçalho do ficheiro. Isto existe porque o caminho manual
deixava uma janela em que a Vercel já tinha publicado o código novo e a base
ainda não tinha as colunas que ele pedia, e essa janela partiu a aplicação em
produção mais do que uma vez.

Para aplicar sem o CLI, `./scripts/gerar-esquema-unico.sh [prefixo]` reúne as
migrações num ficheiro para colar no SQL Editor — dentro de uma transacção e
já a registar-se na tabela de controlo do Supabase, para um `db push` futuro
não as repetir. Sem prefixo faz todas; com `20260910` faz só as desse dia.

`./scripts/registar-aplicadas.sh` gera o SQL que declara todas as migrações do
repositório como já aplicadas. Serve uma vez, na passagem do «colar à mão»
para o `db push`: o que foi colado antes de existir contabilidade não está
registado, e sem isto o primeiro push tentava repeti-lo.

### Decisões que custam a reverter

**Uma pessoa existe sem conta de acesso.** `pessoas.auth_user_id` é anulável e
único. A gestão introduz as ~80 fichas primeiro e convida quem precisa de
entrar depois; a trigger `ligar_pessoa_ao_criar_utilizador` em `auth.users` liga
a conta nova à ficha com o mesmo email e atribui perfil `cliente` se ainda não
houver nenhum. Não inverter isto: obrigar a uma conta por pessoa partia a
digitação inicial e as pessoas que nunca usam a aplicação.

**Papéis ≠ perfil de acesso.** `pessoa_papeis` (aluno, proprietário, instrutor,
tratador, jogador de horseball) descreve o que a pessoa faz no centro e é `N:N`.
`pessoas.perfil` (admin, gestor, instrutor, tratador, cliente) é único e decide
o que a RLS deixa ver. São coisas diferentes com nomes parecidos.

**Despesas guardam o valor total.** `valor_total` é o que sai da conta, tal como
vem no talão. `taxa_iva` é escolhida numa lista; `valor_base` e `valor_iva` são
colunas `GENERATED … STORED`. **Não as envies em INSERT/UPDATE** — o Postgres
recusa. O motivo da escolha é a entrada de dados na cavalariça: um campo em vez
de dois, e o saldo bate sempre certo com o extracto bancário.

**Mensalidades de penso são materializadas.** `mensalidades_penso` tem uma linha
por contrato × mês (`unique (contrato_id, periodo)`, `periodo` sempre no dia 1).
São criadas por `gerar_mensalidades(periodo)`, que é idempotente e não toca em
mensalidades já existentes — um valor excepcional editado à mão sobrevive a nova
geração. É isto que sustenta o widget «pensos por receber» e é a base da
conta-corrente do cliente da Fase 4. Alterar `contratos_penso.valor_mensal` não
altera mensalidades já geradas, e isso é de propósito.

**O estado da mensalidade é derivado.** A trigger
`recebimentos_sincronizar_mensalidade` recalcula `estado` sempre que um
recebimento imputado muda. Pagamento parcial mantém `pendente`; apagar o
recebimento devolve a `pendente`. `anulada` nunca é revertida automaticamente.
Não mexas em `estado` à mão no código da aplicação.

**Contratos de penso não se sobrepõem.** A restrição de exclusão
`contratos_penso_sem_sobreposicao` (`btree_gist`) impede dois contratos do mesmo
cavalo com intervalos de datas a cruzarem-se.

**A box conhece o cavalo, não o contrário.** `boxes.cavalo_id` é único e
anulável (em Postgres vários NULL não colidem, por isso há muitas boxes vazias).
Atribuir uma box liberta primeiro a anterior — ver `atribuirBox` em
`lib/accoes/cavalos.ts`.

**A aplicação não liga a nenhum banco, e não deve ligar.** `contas` é um
livro de registo: saldo inicial mais os movimentos que forem lançados à mão. O
saldo que mostra serve para conferir contra o extracto, não para o substituir,
e a página diz isso em cima. O `iban` existe só para distinguir contas na
lista — nunca o uses para nada que se pareça com uma operação bancária. Ligar
a app a uma conta real foi uma hipótese posta de lado por causa do risco: não
a reintroduzas sem pedido explícito.

**Ninguém tem de criar uma conta para registar dinheiro, e isto já partiu o
uso real.** `recebimentos.conta_id` e `despesas.conta_id` são `not null` — é o
que faz `v_saldos_contas` bater certo, e fica assim —, mas a aplicação estava a
transformar isso num muro: confirmar um pagamento, lançar uma despesa ou
registar um recebimento batiam todos em «ainda não há contas registadas, crie
uma conta». Para um centro que não liga a app a banco nenhum isso é burocracia
pura, ainda por cima com a palavra «conta» a querer dizer outra coisa.

`contaDeDestino()` em `lib/contas.ts` resolve-o: usa a conta escolhida, ou a
que houver, e **se não houver nenhuma cria a «Caixa»** no momento em que o
primeiro movimento precisa dela. As quatro acções que lançam dinheiro
(`guardarDespesa`, `guardarRecebimento`, `receberPensos`, `receberEncargo`) e a
confirmação de pagamentos passam por lá. Um 23505 na criação não é erro: é
outra sessão a ter criado a Caixa primeiro, e é essa que se usa.

Do lado da interface, a regra é **só se pergunta quando há mais do que uma
conta**. Com uma só, ou nenhuma, o selector não aparece em lado nenhum — nem no
painel de confirmar, nem no de receber, nem nos formulários completos. E
nenhum ecrã volta a mandar criar contas: os estados vazios dizem que a caixa
nasce sozinha, e criar uma conta à parte é para quem quiser separar o dinheiro
por banco.

**Raças e pelagens são uma lista, não uma chave estrangeira.**
`opcoes_cavalo` (tipo × valor) é o que o formulário oferece, mas
`cavalos.raca` e `cavalos.pelagem` continuam a ser `text`. É de propósito: um
cavalo gravado com um valor fora da lista continua válido, a pesquisa por
`raca.ilike` continua a funcionar, e acrescentar uma raça é um INSERT e não
uma migração. O preço é que mudar o nome de uma opção tem de mudar também os
cavalos que a usam — é o que `renomearOpcaoCavalo` faz, e por isso é que essa
acção existe em vez de um simples UPDATE. O índice único é sobre
`(tipo, lower(btrim(valor)))`, para «Lusitano» e «lusitano» não coexistirem.

**Aulas, treinos e competições são o mesmo `eventos`.** Partilham data, hora,
local, responsável, participantes, presenças e avisos; o que muda é o `tipo`.
Daí haver um só quadro do dia e um só calendário a exportar. Um tipo novo
(estágio, passeio) é acrescentar um valor ao enum. Não voltes a partir isto em
tabelas por tipo.

**A repetição semanal é uma etiqueta, não um objecto.** Numa escola quase tudo
é semanal, e marcar a aula de terça às 18:30 oito vezes era nove campos vezes
oito. `eventos.serie_id` é só isto: as marcações nascidas da mesma repetição
partilham um id. **Não há tabela de séries, e não deve haver** — cada evento
continua independente: cancelar o de 4 de Novembro não mexe nos outros,
mudar-lhe a hora ou o picadeiro não muda a dos outros, e a convocatória é de
cada um, porque é assim que acontece na cavalariça. A etiqueta serve para
responder a «e as seguintes?» nas duas únicas perguntas que valem a pena em
bloco — `copiarConvocatoriaDaSerie` e `cancelarSeguintesDaSerie` — e nada
mais. Um evento que perca os irmãos continua um evento válido, e desenhar a
agenda nunca precisa de ir buscar a série.

O campo «Repetir» só aparece ao **marcar** (`components/formularios/campos-evento.tsx`):
numa edição, mudar a hora de uma aula não devia criar sete aulas novas. Com
equipa escolhida, a convocatória da equipa entra em **todas** as marcações —
senão a repetição poupava metade do trabalho.

**Um cavalo não pode estar em dois eventos sobrepostos.** A restrição tem de
comparar horas que vivem em `eventos` com linhas de `evento_participantes`, e
uma restrição de exclusão não olha para outra tabela. Por isso
`evento_participantes.periodo` guarda uma cópia da janela do evento, mantida
por dois triggers: `preencher_periodo_participante` ao inserir ou mudar o
participante, e `propagar_janela_do_evento` quando o evento muda de data, de
hora ou é cancelado. Fica a `null` sem cavalo ou com o evento cancelado, e as
restrições de exclusão ignoram operandos nulos — que é precisamente o
comportamento desejado. **Nunca escrevas `periodo` a partir da aplicação.**

**A ferração é um histórico, não duas colunas em `cavalos`.** O que interessa
é de quanto em quanto tempo *este* cavalo precisa, quem o ferrou e quanto
custou — e duas colunas só sabem a última. `ferracoes` tem uma linha por
passagem do ferrador; `v_ferracao_cavalos` dá a última de cada cavalo para a
listagem não fazer sessenta consultas, e é um `left join`, porque o cavalo que
nunca foi ferrado é precisamente o que interessa ver. **`proxima_em` é escrito
à mão e não calculado**: o intervalo não é igual para todos (um cavalo de
competição gasta mais depressa) e quem ferra sabe, ao sair, quando quer voltar;
o formulário sugere seis semanas e deixa mudar. **Escrever é de `e_equipa()` e
não só da gestão** — quem recebe o ferrador na cavalariça é o tratador, e
obrigá-lo a pedir à gestão era a maneira certa de o registo não existir. O
custo que lá fica é nota do que foi combinado; a despesa lança-se no
financeiro, imputada ao cavalo.

**Encargos avulsos são o que se cobra fora da mensalidade.** A ferração
obrigou a isto: na Quinta da Figueira **depende do cliente** — uns pagam ao
ferrador na hora, noutros é o centro que paga e recobra. O segundo caso não
tinha onde viver, porque uma mensalidade é por contrato × mês e não por
acontecimento. `encargos` é uma linha de «isto fica a dever-se»: a quem,
quanto, porquê e de que cavalo. O veterinário e o transporte cabem lá sem
migração nova, de propósito.

O desenho é o das mensalidades, para quem conhece uma reconhecer o outro: o
**estado é derivado** dos recebimentos imputados (`recebimentos.encargo_id`,
trigger `recebimentos_sincronizar_encargo`) e não se escreve à mão; pagamento
parcial mantém `pendente`; `anulado` nunca é revertido sozinho. Um recebimento
paga uma mensalidade **ou** um encargo, nunca os dois — com os dois
preenchidos não se saberia a qual respeitava o dinheiro. O índice único sobre
`ferracao_id` faz com que a mesma ferração não possa ser cobrada duas vezes,
e é isso que torna o botão idempotente.

**Uma declaração de pagamento não é um recebimento, e nunca pode vir a ser.**
`pagamentos_declarados` é o cliente a dizer «já paguei»: quanto, quando, como,
e contra que mês ou encargo. Existe porque o extracto do banco diz «TRF 180,00
JOAO B» e não diz de que mês era, nem de que cavalo, nem se eram dois meses de
uma vez — e quem sabe isso é quem pagou.

- **Declarar não mexe em estado nenhum.** `mensalidades_penso.estado` e
  `encargos.estado` continuam a derivar **só** dos recebimentos imputados. Não
  há trigger nenhuma daqui para lá, e não pode haver: com uma, qualquer cliente
  se dava por pago carregando num botão, e a aplicação passava a ser um
  intermediário de pagamento em vez de um livro de registo.
  `supabase/tests/09_pagamentos_declarados.sql` prova isto — se alguém ligar as
  duas coisas «para poupar um clique», é aí que rebenta.
- **O cliente declara, só a gestão decide.** A política de `update` é
  `e_gestao()`, e é ela — não uma verificação de interface — que impede o
  cliente de pôr a própria declaração a `confirmada`.
- **`pessoa_id`, `estado` e a decisão são carimbados por trigger**
  (`pagamentos_declarados_carimbar`, `…_carimbar_decisao`), como em
  `notas_cavalo`. Uma declaração nasce sempre `pendente`, venha o que vier no
  INSERT.
- **`confirmar_pagamento_declarado()` cria o recebimento e fecha a declaração
  na mesma transacção.** Sem isso, um erro entre os dois passos deixava
  dinheiro lançado com a declaração ainda por confirmar, e a gestão a
  confirmá-la outra vez. **Não é SECURITY DEFINER de propósito** — corre com a
  identidade de quem chama, e é a RLS de `recebimentos` que trava um cliente.
  A guarda `e_gestao()` lá dentro serve só para a mensagem de erro dizer a
  verdade; se alguém tornar a função SECURITY DEFINER, essa guarda passa a ser
  a única coisa entre um cliente e a caixa do centro.
- **O que fica registado é o que a gestão confirmar**, não o que o cliente
  escreveu: valor, data e método são corrigíveis ao confirmar. **A conta de
  destino escolhe-se sempre do lado da gestão** — o cliente não sabe, nem deve
  saber, para que conta do centro o dinheiro entrou.
- **Recusar exige motivo**, porque é a única coisa que o cliente vai ler. A
  recusa liberta o índice único, por isso ele pode declarar outra vez com os
  dados certos.
- **Um índice único por item enquanto pendente** faz com que carregar duas
  vezes no botão não declare duas vezes — e é isso que deixa a linha dizer «a
  aguardar confirmação» sem ambiguidade.
- O que substitui a notificação, aqui como nas notas, é
  `<PagamentosPorConfirmar>`: completo em `/financeiro/por-receber`, compacto
  no painel, e filtrado por pessoa na ficha dela. Sem ele, o cliente ficava
  convencido de que tinha avisado o centro — o que é pior do que não ter
  avisado.

**Avisos, não chat.** `avisos` pertence a um evento OU a uma equipa, nunca aos
dois. É comunicação de um para muitos: aparece no quadro do dia e vai na
descrição do evento no calendário do telemóvel. Foi uma decisão deliberada e
não um passo intermédio — um chat sem notificações fiáveis (no iPhone só
funcionam com a app instalada no ecrã principal) ficaria deserto, com as
conversas a continuarem no WhatsApp. **Isto continua a valer para conversa
geral**: não construas uma sem pedido explícito.

**`notas_cavalo` é a excepção, e é excepção por ser presa a um cavalo.** Não é
chat, é o caderno do cavalo: o dono pergunta, a cavalariça responde, e daqui a
um ano lê-se o que se passou com ele. Pouco volume, nada urgente, e o valor
está em ficar agarrado à ficha. É também o que responde ao cliente que quer
corrigir dados do cavalo — ele escreve, a gestão corrige à mão, que é o que
faria de qualquer maneira para confirmar antes de gravar; uma fila de
propostas com estado resolveria o mesmo e traria uma notificação que a
aplicação não sabe dar.

- **`autor_id` e `de_equipa` são carimbados por trigger**
  (`carimbar_autor_da_nota`), nunca enviados pela aplicação: deixá-la dizer
  quem escreveu era deixá-la escrever em nome de outro. `de_equipa` é uma
  cópia do momento, e não uma consulta a `pessoas.perfil` — um tratador que
  mude de perfil daqui a um ano não deve reescrever quem respondeu a quem.
- **Ninguém edita nem apaga uma nota**, nem o próprio autor; só a gestão
  apaga, para o caso de alguém escrever o que não devia. Uma conversa
  reescrita depois do facto não serve de caderno.
- **É a primeira vez que um cliente escreve nesta aplicação.** A política de
  `insert` é a mesma de `cavalos_ler`: a equipa, e o dono do cavalo.
- **O que substitui a notificação é `<NotasPorResponder>` no painel** da
  gestão e da equipa. Sem isso, uma pergunta ficava num cavalo à espera que
  alguém por acaso lá fosse. O cartão não aparece quando não há nada — um
  cartão vazio todos os dias ensina a não olhar para ele.
- Se ao fim de umas semanas ninguém lá escrever, apaga-se sem pena: o que
  decide isto é a gestão responder lá dentro nos primeiros dias.

**As subscrições de notificação são a tabela mais fechada da aplicação.**
Com `endpoint`, `p256dh` e `auth` manda-se uma notificação para o telemóvel de
alguém. Por isso `subscricoes_push` tem uma só política — cada pessoa com as
suas — e **não há excepção para a gestão**: ninguém tem motivo para ler a
morada do telemóvel de outra pessoa a partir de uma sessão.

**O token de calendário é um segredo ao portador.** Vive em `calendarios`, à
parte de `pessoas`, porque a equipa lê `pessoas` inteira e não pode ler os
tokens dos outros. `agenda_por_token()` é SECURITY DEFINER e é o que serve a
agenda a quem só tem o token — uma aplicação de calendário não sabe iniciar
sessão. `/calendario/<token>.ics` está nos caminhos públicos do middleware por
essa razão.

### Vistas

Todas com `security_invoker = on`, para a RLS aplicada ser a de quem consulta.
Uma vista sem isto seria um buraco na RLS — se criares outra, não te esqueças.

- `v_saldos_contas` — saldo inicial + recebimentos − despesas **pagas**
- `v_resumo_mensal` — receitas vs. despesas por mês
- `v_despesas_por_categoria` — despesa por categoria e mês
- `v_pensos_por_receber` — mensalidades com valor pago e valor em falta
- `v_ferracao_cavalos` — uma linha por cavalo com a última ferração e o estado
  da próxima (`sem_registo`, `sem_data`, `atrasada`, `esta_semana`, `em_dia`)
- `v_encargos_por_receber` — encargos avulsos com valor pago e valor em falta
- `v_notas_por_responder` — cavalos com conversa, com a última palavra e de que
  lado veio (`por_responder` = a última foi do cliente)

---

## 4. Segurança

**RLS activa em todas as tabelas de `public`.** Os testes verificam-no
automaticamente; se acrescentares uma tabela sem política, o teste falha.

Funções auxiliares (SECURITY DEFINER de propósito — correm como dono e por isso
ignoram a RLS de `pessoas`, o que evita recursão dentro das próprias políticas):

- `pessoa_actual_id()`, `perfil_actual()`
- `e_gestao()` — admin ou gestor
- `e_equipa()` — admin, gestor, instrutor ou tratador
- `e_admin()`
- `e_instrutor_ou_gestao()` — quem planeia o dia: admin, gestor ou instrutor
- `participo_no_evento(uuid)`, `sou_membro_da_equipa(uuid)` — SECURITY DEFINER
  porque uma política de `evento_participantes` que consultasse
  `evento_participantes` entraria em recursão infinita

Resumo do que cada perfil vê:

| | pessoas / cavalos / boxes | contratos | financeiro |
|---|---|---|---|
| admin, gestor | tudo | tudo | tudo |
| instrutor, tratador | tudo | **não** (têm valores) | **não** |
| cliente | só o que é dele | só os dele | só os recebimentos dele |

`lib/permissoes.ts` espelha `e_gestao()`/`e_equipa()` em TypeScript, mas serve
apenas para decidir o que mostrar. **A protecção é a RLS.** Nunca confies só na
verificação da interface.

**Arranque.** Sem admin não é possível escrever nada. `reclamar_primeiro_admin()`
resolve isso: qualquer utilizador autenticado pode chamá-la enquanto não existir
nenhum admin activo. A página é `/primeiro-acesso`.

**Storage.** Dois buckets privados: `cavalos` (fotos, leitura para qualquer
autenticado) e `documentos` (faturas digitalizadas, só gestão). Os ficheiros são
servidos por URL assinado gerado no servidor — ver `components/foto-cavalo.tsx`
e `components/ligacao-anexo.tsx`.

**Os ficheiros sobem do browser, nunca pelo Server Action.**
`components/campo-ficheiro.tsx` carrega directamente para o Storage e mete o
caminho num campo escondido; a acção só recebe texto. Não voltes a pôr um
`<input type="file">` num formulário de Server Action: o Next aceita 1 MB de
corpo por omissão e a Vercel corta aos 4,5 MB, e uma fotografia de telemóvel
não cabe em nenhum dos dois — falhava com um erro que não explicava nada.

---

## 5. Organização do código

```
app/
  (publico)/      entrar, recuperar-password, definir-password, primeiro-acesso
  (painel)/       aplicação autenticada — layout com navegação e sessão
    page.tsx      dashboard, com uma variante por perfil
    agenda/       quadro do dia, e a ficha de cada evento
    equipas/      grupos de Horseball
    conta/        perfil e subscrição de calendário
    pagamentos/   a conta-corrente vista de quem paga (o cliente)
    pessoas/      ficha, e `pessoas/[id]/pensos` — a conta-corrente do cliente
    cavalos/      ficha, e `cavalos/opcoes` — as listas de raças e pelagens
    boxes/  contratos/
    financeiro/   resumo (page.tsx), por-receber/, despesas/, recebimentos/,
                  contas/ (caixa e bancos), definicoes/ → fornecedores/ e
                  categorias/
  auth/callback/  troca do código de email por sessão
  calendario/     ficheiro iCal por token, sem sessão
  manifest.ts     manifesto da PWA
components/
  ui/             kit de base (botao, campos, superficie, tabela, ferradura)
  formularios/    campos de cada entidade, partilhados entre criar e editar
  navegacao.tsx   barra lateral, barra de separadores do telemóvel e «Mais»
  pagamento-penso.tsx  receber mensalidades sem sair da conta-corrente
  calendario-mes.tsx   a grelha do mês da agenda
  navegacao-agenda.tsx setas, salto por data e a escolha de vista
  vistas-agenda.tsx    a semana em lista e o quadro do dia
  lista-eventos.tsx    a linha de um evento, partilhada por todas as vistas
  cartao-evento.tsx    o evento em grande, com convocados e avisos
  serie-evento.tsx     a repetição semanal vista de dentro de uma marcação
  convite-acesso.tsx   estado de acesso de uma pessoa, e o convite
  accoes-ficha.tsx     desactivar/terminar e apagar, no topo de uma ficha
  ferracao-cavalo.tsx  quando foi ferrado, e quando volta a ser
  notas-cavalo.tsx     a conversa de um cavalo, na ficha dele
  notas-por-responder.tsx  as perguntas por responder, no painel da equipa
  formularios/importar-contacto.tsx  preencher a ficha a partir dos contactos
  formularios/selector-com-outro.tsx  lista com saída para escrever uma nova
  opcoes-cavalo.tsx  gerir as listas em /cavalos/opcoes
  resumo-do-dia.tsx  o que está marcado, no topo do painel
  activar-notificacoes.tsx  ligar e desligar os avisos neste aparelho
  lembrar-pagamento.tsx  o botão que avisa um cliente do que deve
  declarar-pagamento.tsx  «Já paguei», do lado de quem paga
  confirmar-pagamento.tsx  confirmar ou recusar, do lado de quem recebe
  pagamentos-por-confirmar.tsx  o que está à espera de decisão
  escolha-metodo.tsx   método de pagamento em pastilhas, partilhado
  usar-formulario.ts   o gancho que limpa um formulário depois de gravar
  (publico)/auth/ligar/  lê a sessão do fragmento do link de email
  notificacao.tsx    confirmação depois de gravar e redireccionar
lib/
  supabase/       clientes de browser, servidor e middleware
  accoes/         Server Actions, uma por área
  tipos-bd.ts     tipos da base de dados (escritos à mão — ver abaixo)
  formatos.ts     euros, datas, horas, meses, leitura de valores escritos por pessoas
  fatura-qr.ts    leitura do QR das faturas portuguesas (+ testes)
  vcard.ts        leitura de cartões de contacto .vcf (+ testes)
  ical.ts         geração do ficheiro de calendário (+ testes)
  rotulos.ts      rótulos PT-PT dos enumerados
  opcoes-cavalo.ts  o que o selector de raças partilha com a Server Action
  origem.ts       o endereço público que vai nos links de email (+ testes)
  contas.ts       a conta onde o dinheiro entra, criada sozinha se faltar
  notificacoes/enviar.ts  o envio de avisos — o único sítio com a chave de serviço
  supabase/sem-sessao.ts  cliente sem cookies, para falar em nome de outra pessoa
supabase/
  migrations/     esquema versionado
  seed.sql        dados de demonstração (só desenvolvimento)
  tests/          arremedo do Supabase + testes de RLS (01 geral, 02 eventos,
                  03 ferração, 04 contratos, 05 cavalos, 06 encargos,
                  07 notas, 08 subscrições, 09 pagamentos declarados)
scripts/
  validar-esquema.sh      aplica migrações e corre os testes
  gerar-esquema-unico.sh  junta migrações num ficheiro para o SQL Editor
  registar-aplicadas.sh   declara as migrações já aplicadas, antes do 1.º push
  gerar-icones.mjs     gera os ícones da PWA
```

### Latência

Cada navegação é uma renderização no servidor que fala com o Supabase, por isso
o número de idas e voltas é o que se sente ao clicar.

- `obterUtilizador()` e `obterPessoaSessao()` em `lib/sessao.ts` estão
  embrulhados em `cache()` do React. **Usa-os sempre**; não chames
  `supabase.auth.getUser()` directamente num Server Component. `getUser()` é um
  pedido de rede ao servidor de autenticação, não uma leitura do cookie, e o
  layout e a página precisam ambos da sessão — sem a cache seriam três pedidos
  por clique em vez de um.
- **Conta as idas e voltas antes de culpar o servidor.** Uma navegação tinha
  **três em fila** antes de a primeira consulta útil arrancar: o middleware a
  perguntar quem é a pessoa, a página a perguntar o mesmo outra vez (a cache
  do React não atravessa invocações — o middleware e a função são duas), e só
  depois o `select` em `pessoas`. As duas primeiras eram a mesma pergunta.
- **O middleware usa `getClaims()`, não `getUser()`.** `getUser()` é um pedido
  de rede ao servidor de autenticação em **cada** pedido, e o middleware corre
  antes de tudo: a página nem começava a ser gerada enquanto a resposta não
  chegasse. `getClaims()` verifica a assinatura do token localmente **se o
  projecto Supabase usar chaves assimétricas**; com o segredo partilhado
  antigo (HS256) cai sozinho para `getUser()`, por isso nunca é mais lento.
  A renovação do cookie mantém-se (passa por `getSession()`). **Ligar as
  chaves assimétricas em Authentication → JWT Keys é o que transforma isto
  numa ida e volta a menos por clique.**
- **`obterUtilizador()` também usa `getClaims()`**, e devolve só `{ id }` —
  é tudo o que a aplicação usa dele. Com isso, `obterPessoaSessao()` passa a
  ser a **primeira e única** ida à rede do caminho da sessão: de três em fila
  para uma. As Server Actions continuam a chamar `supabase.auth.getUser()`
  directamente para o `criado_por`; aí é uma vez por acção da pessoa, não por
  renderização, e não vale a pena mexer.
  Em segurança não se perde nada: quem decide o que cada um vê é a RLS, e a
  página volta a verificar a sessão. O middleware só encaminha.
- `vercel.json` fixa a região das funções em `dub1` (Dublin), porque o projecto
  Supabase está em West EU (Ireland), `eu-west-1`. **As duas têm de
  corresponder**: por omissão a Vercel corre em Washington, e com o Supabase na
  Europa cada ida e volta custava ~180 ms. Se mudares a região do Supabase, muda
  aqui também — Frankfurt `fra1`, Londres `lhr1`, Paris `cdg1`, Estocolmo `arn1`.
- `app/(painel)/loading.tsx` é o que o Next mostra enquanto gera a página, e
  também o que pré-carrega ao passar por cima das ligações. Sem ele o clique
  parece não ter sido registado.

### Ficheiros em `public/`

Nunca leias `public/` com `fs` em código que corre no servidor. **Na Vercel
esses ficheiros não entram no pacote da função** — vão para o CDN à parte — e
qualquer `existsSync` sobre eles dá falso em produção enquanto funciona em
local, que é o pior dos dois mundos. Imagens usam `import` estático
(`import logo from '@/public/marca/logotipo.jpg'`), que as resolve na
compilação, dá as dimensões ao `next/image` e falha o build se faltarem.

### Convenções

- Formulários usam `<FormularioEntidade>` com Server Actions e `useActionState`.
  O botão **«Guardar e criar outro»** existe para a digitação inicial (60
  cavalos, 80 pessoas): limpa o formulário e devolve o foco ao primeiro campo.
- Campos opcionais vazios gravam `NULL`, não `''` — ver `textoOuNulo`.
- Valores monetários passam por `lerValorMonetario`, que aceita `1234,56`,
  `1.234,56` e `1234.56`.
- Datas do Postgres são tratadas como texto `AAAA-MM-DD`. **Não as passes por
  `new Date()`** para formatar: o fuso do browser faz a data saltar um dia.
- Erros do Postgres passam por `traduzirErro` para chegarem ao utilizador em
  português.
- Selectores são `<select>` nativos, para no telemóvel abrirem o selector do
  sistema.
- Nas listagens, a ligação para a ficha é `<LigacaoFicha>` de
  `components/ui/tabela.tsx`, **não** um `<Link>` cru. Ela estica-se por cima da
  linha toda (`after:absolute after:inset-0` sobre o `<tr>`, que é `relative`),
  o que torna a linha inteira clicável mantendo uma só ligação real — nome
  acessível, foco pelo teclado e «abrir em nova janela» intactos. Ligações
  secundárias na mesma linha usam `<LigacaoInterna>`, senão ficam por baixo.
  Antes disto só o texto do nome respondia ao clique e só ganhava sublinhado ao
  passar o rato: num telemóvel era indescobrível, e parecia que editar não
  funcionava.
- Nas listagens, os `<Td>` levam `rotulo` — ver «Interface no telemóvel».
- **Uma acção que redirecciona confirma-se com `comConfirmacao()`**, de
  `lib/accoes/comum.ts`: acrescenta `?feito=criado|guardado|apagado` ao
  destino e `<Notificacao>` (no layout do painel) mostra e limpa a marca. Sem
  isto, guardar uma edição levava de volta à mesma ficha sem nada mudar no
  ecrã. Viaja uma chave, nunca o texto da mensagem — senão qualquer pessoa
  punha a frase que quisesse no endereço de outra.
- **Gravar volta à listagem, ao criar e ao editar.** A regra anterior era
  «criar volta à listagem, editar fica na ficha», e era ela que dava a
  sensação de que nada tinha acontecido: a ficha de uma pessoa ou de um cavalo
  é o mesmo formulário, com os mesmos vinte campos e os mesmos valores, por
  isso gravar deixava o ecrã exactamente igual. A listagem é de onde se veio,
  mostra a alteração na linha, e o aviso de «Alterações guardadas» aparece por
  cima. Na prática só `cavalos` e `pessoas` é que ficavam na ficha — as outras
  entidades já voltavam todas à listagem.
  **Excepção deliberada: um evento e uma equipa continuam a abrir na ficha**,
  ao criar e ao editar. Aí a ficha **não** é o formulário: tem a convocatória,
  os avisos e os membros, que é o passo seguinte de quem acabou de marcar. O
  que se vê a seguir a gravar é diferente do que se preencheu, e é isso que
  distingue este caso do outro.
- Formulários longos dividem-se em `<SeccaoCampos>` com título. Os de pessoa e
  de cavalo eram vinte campos seguidos sem divisão nenhuma.
- **Um formulário dentro da página limpa-se depois de gravar** —
  `useFormularioDeAccao()` em `components/usar-formulario.ts`. Publicar um
  aviso, convocar uma pessoa, registar uma ferração ou acrescentar uma raça
  deixavam os campos preenchidos: para quem está do outro lado do ecrã isso
  lê-se como «não aconteceu nada», e convida a carregar outra vez no botão com
  o mesmo texto lá dentro. O gancho faz `reset()` e devolve o foco ao primeiro
  campo — que é também o que traz a página de volta ao sítio onde se estava a
  trabalhar. **Não o uses num bloco de caixas de visto que espelha o estado do
  servidor** (as presenças): `reset()` devolveria as marcas ao que estavam
  antes de gravar.
- **Um erro de gravação é trazido ao ecrã**, não deixado no topo do
  formulário. `<FormularioEntidade>` faz `scrollIntoView` da mensagem quando a
  acção falha: o botão de guardar está vinte campos abaixo do sítio onde o
  erro aparece, e quem carregava nele via a página ficar na mesma e concluía
  que não tinha acontecido nada.
- **Quem sai do centro desactiva-se; apagar é para o engano de digitação.**
  `<AccoesFicha>` põe as duas saídas lado a lado no cabeçalho da ficha de
  **pessoa**, **cavalo** e **contrato**; antes era um só botão «Apagar» no
  fundo do formulário, por baixo de vinte campos, e a recusa mandava «marque
  como inactivo» — que era uma caixa de visto escondida no meio dos mesmos
  vinte campos. A saída branda muda de nome conforme a ficha: uma pessoa e um
  cavalo **desactivam-se** (`activo`), um contrato **termina-se**
  (`data_fim`). Cada recusa conta o que prende o registo
  (`oQuePrendePessoa()`, `oQuePrendeCavalo()`) em vez de listar hipóteses. O
  estado activo saiu do formulário de pessoa — viaja escondido, para não se
  lhe tocar sem querer ao corrigir um telefone. Ninguém se desactiva a si
  próprio.
- **Apagar um cavalo perde três coisas em silêncio.** Só
  `contratos_penso.cavalo_id` é `restrict`; `despesas.cavalo_id` e
  `evento_participantes.cavalo_id` são `set null` (a despesa fica sem saber de
  que cavalo era, a aula perde o par aluno↔cavalo) e `ferracoes` é `cascade`
  (o histórico morre com ele). Por isso `apagarCavalo` conta **antes** de
  apagar e recusa — apagar é só para a ficha escrita por engano. A box não
  entra na conta: ficar a `null` é precisamente o que se quer quando um cavalo
  sai. `supabase/tests/05_cavalos.sql` prova cada um destes quatro
  comportamentos.
- **Apagar um contrato de penso é a operação perigosa da aplicação, e a base
  não trava.** `mensalidades_penso.contrato_id` é `on delete cascade` e
  `recebimentos.mensalidade_id` é `on delete set null`: apagar o contrato leva
  as mensalidades consigo e **desliga os pagamentos do mês que pagaram**, sem
  erro nenhum. O dinheiro fica, mas deixa de se saber ao que respeitava.
  `apagarContrato` recusa quando há pagamentos imputados, e
  `supabase/tests/04_contratos.sql` prova o comportamento da base que o
  justifica — se um dia essa chave passar a `restrict`, o teste falha e o
  travão pode descer para o esquema, que é onde se preferia que vivesse.
- **`lib/notificacoes/enviar.ts` é o único ficheiro com uma chave que ignora
  a RLS, e isso é para continuar assim.** Uma notificação vai ao telemóvel de
  **outra pessoa**, e isso obriga a ler a subscrição dela: o caso que manda é
  um cliente escrever uma pergunta e a equipa ter de ser avisada — a acção
  corre com a identidade do cliente, que não pode (nem deve) ler as
  subscrições do centro. As regras do ficheiro: é o único que lê
  `SUPABASE_SERVICE_ROLE_KEY`; não exporta o cliente privilegiado, só funções
  que mandam avisos; não recebe de fora nome de tabela, filtro nem consulta;
  e só toca em `subscricoes_push`. O `import 'server-only'` faz a compilação
  falhar se alguém o importar do lado do cliente — é a diferença entre uma
  regra escrita e uma que se faz cumprir sozinha. **Se vires
  `SUPABASE_SERVICE_ROLE_KEY` noutro sítio, está errado.**
- **Avisar nunca trava o que o originou.** `avisar()` não lança: uma
  notificação que não sai não pode fazer falhar a nota que alguém escreveu. O
  `<NotasPorResponder>` no painel continua a ser a rede por baixo. O preço
  disso é o silêncio ser ambíguo enquanto se monta a coisa — por isso existe
  **«Enviar um teste a mim próprio»** em `/conta`, que chama
  `avisarComRelatorio()` e é o único caminho em que o motivo verdadeiro chega
  ao ecrã: que variável falta pelo nome (nunca o valor), o que a base
  respondeu, ou o que o serviço de push devolveu. O destino é sempre a própria
  pessoa, por isso não revela nada sobre os aparelhos de ninguém.
- **O aviso de mensalidade é um botão, não um automatismo** —
  `lembrarPagamento`, na conta-corrente. Foi decisão do cliente: há quem pague
  sempre a dia 8 e esteja de férias, e há quem precise de um toque. Um aviso
  automático a toda a gente que passa do vencimento era a maneira mais rápida
  de estes avisos passarem a ser ignorados. **Não o automatizes sem pedido.**
- **A convocatória avisa uma vez, ao convocar**, e não em cada correcção de
  hora ou de cavalo: é o aviso mais frequente da aplicação.
- **`/instalar` é público de propósito.** É o guia que a gestão manda por
  mensagem antes de a pessoa ter entrado — e existe porque **no iPhone as
  notificações só funcionam com a aplicação no ecrã principal**; num separador
  normal do Safari não há sequer pedido de autorização. O
  `<ActivarNotificacoes>` detecta esse caso e explica o caminho em vez de
  mostrar um botão que não faria nada.
- Fichas e formulários levam `voltar={{ href, rotulo }}` no
  `<CabecalhoPagina>`: no telemóvel não há barra lateral e a de baixo só tem
  as secções principais, por isso não havia caminho de volta à listagem.

### A agenda: três vistas sobre os mesmos eventos

`/agenda` abre no **mês**; `?vista=semana` e `?vista=dia` são as outras duas.
Abria sempre no quadro de um dia, e um dia não diz nada sobre a semana a
seguir — para saber se a sexta estava cheia era preciso lá ir.

- **Mês** (`<CalendarioMes>`) é a vista de quem planeia. Abaixo de `sm` não há
  largura para texto em sete colunas, por isso cada evento vira um ponto da
  cor do tipo e a contagem fica ao lado do número do dia.
- **Semana** (`<VistaSemana>`) são os sete dias em lista, incluindo os vazios —
  é o vazio que diz onde há espaço.
- **Dia** (`<VistaDia>`) é o quadro de sempre, com os pares aluno↔cavalo à
  vista, que é o que se leva para a cavalariça.

Duas coisas a saber antes de lhe mexer:

- **O `?dia=` é sempre um dia**, também no mês e na semana, onde serve só para
  dizer qual. É isso que faz mudar de vista não perder o sítio.
- **O mês e a semana não carregam os nomes dos convocados**, só os contam. O
  `select` completo é só para a vista de dia — daí haver duas consultas e não
  um `select` condicional (os tipos do Supabase precisam de um literal).

As três cores dos tipos têm de se distinguir num ponto de seis pixels. O
Horseball usava o verde de «sucesso», que à mesma escala era a mesma mancha
que o verde de acção das aulas; por isso existe o token `--info` (azul).

### Quem entra, e como

Não há registo público. **A gestão escreve a ficha e envia o convite**, em
`/pessoas/[id]` → «Acesso à aplicação». `convidarPessoa()` manda um link de
email (`signInWithOtp` com `shouldCreateUser`), a conta nasce quando a pessoa
carrega no link, e a trigger `ligar_pessoa_ao_criar_utilizador` liga-a à ficha
com o mesmo email — por isso o email da ficha tem de ser aquele para onde o
convite vai.

- O envio usa `criarClienteSemSessao()`, **nunca o cliente de servidor
  normal**: `signInWithOtp` mexe no armazenamento de sessão de quem o chama, e
  com os cookies do admin agarrados isso arriscava trocar-lhe a sessão.
- **O link do convite não pode depender do PKCE, e isto já partiu uma vez.**
  Quem pede o convite é a gestão; quem carrega no link é outra pessoa, noutro
  browser. No PKCE a prova fica num cookie de quem pediu, por isso
  `exchangeCodeForSession` nunca podia funcionar aqui. `/auth/callback` trata
  as três formas que o Supabase usa, e tem de continuar a tratar as três:
  `?code=` (PKCE — serve a recuperação de palavra-passe, que a própria pessoa
  pede), `?token_hash=` (verificado no servidor, serve em qualquer
  dispositivo) e `#access_token=` (fragmento, que **nunca chega ao servidor** —
  encaminha-se para `/auth/ligar`, que o lê no browser e guarda a sessão).
- **`auth_user_id` não quer dizer que a pessoa entrou, e isto já partiu uma
  vez.** `signInWithOtp(shouldCreateUser)` cria a linha em `auth.users` **no
  envio do convite**, e a trigger `ligar_pessoa_ao_criar_utilizador` preenche
  logo `auth_user_id`. Com o travão em `auth_user_id`, a ficha passava a dizer
  «tem conta» assim que o primeiro convite saía e deixava de ser possível
  reenviá-lo — a quem ainda não tinha entrado uma única vez. O sinal
  verdadeiro é **`acesso_confirmado_em`**, escrito pela trigger
  `marcar_acesso_ao_entrar` quando `auth.users.last_sign_in_at` aparece.
- Os três estados da ficha saem daqui: nada = nunca convidado;
  `convidado_em` sem `acesso_confirmado_em` = convidado e ainda não entrou;
  `acesso_confirmado_em` = entra mesmo.
- Depois de entrar pelo link, a pessoa define a palavra-passe em `/conta` —
  sem isso só conseguiria voltar a entrar pedindo outro link de cada vez.
- **Não é preciso nenhuma chave de serviço.** Se alguma vez se pensar em
  `auth.admin.inviteUserByEmail`, note-se que isso obriga a pôr a
  `service_role` no ambiente, que ignora toda a RLS. Este caminho não precisa.

O que o Supabase precisa de ter configurado: o endereço do site e
`/auth/callback` em **Authentication → URL Configuration**, e SMTP próprio —
o serviço de email de origem manda meia dúzia de mensagens por hora, o que não
chega para convidar oitenta pessoas.

**Quando o convite não sai, a razão está nos Auth Logs do Supabase**, e a
mensagem da aplicação di-la em português: `traduzirErroAutenticacao` em
`lib/accoes/resultado.ts` separa limite de envios (429), SMTP que recusa (500
ou «Error sending»), contas por email desligadas e endereço recusado, e leva
sempre a mensagem crua entre parênteses. Antes disto havia uma só frase fixa a
dizer que o Supabase limitava os emails por hora: mandava esperar uma hora por
um problema que não passava sozinho. **Não voltes a adivinhar a causa.**

**O link do convite apontava para `localhost:3000`.** `.env.example` traz
`NEXT_PUBLIC_SITE_URL=http://localhost:3000`, e copiar esse ficheiro para as
variáveis da Vercel é o caminho mais natural do mundo — o resultado era um
convite com um link para a máquina de quem programa, na caixa de correio de
outra pessoa. `escolherOrigem()` em `lib/origem.ts` (com testes) ignora agora
um endereço local configurado quando o pedido vem de um sítio verdadeiro. Em
desenvolvimento nada muda. **Isto não dispensa a configuração**: o Site URL e
a lista de Redirect URLs em **Authentication → URL Configuration** têm de
apontar para o domínio de produção, senão é o Supabase que troca o destino do
link pelo Site URL dele.

**O convite abria o ecrã de entrada normal, e isto é a terceira vez que o
mesmo buraco morde.** Se `/auth/callback` não estiver na lista de **Redirect
URLs** do projecto, o Supabase **troca o destino em silêncio pelo Site URL** e
manda a pessoa para a raiz com a sessão no fragmento. A raiz exige sessão, o
fragmento nunca chega ao servidor, o middleware não vê ninguém e encaminha
para `/entrar` — e quem foi convidado aterra num formulário a pedir-lhe uma
palavra-passe que nunca teve. `<SessaoDoFragmento>` (no layout de `(publico)`)
reconhece um fragmento com `access_token` em qualquer página pública e
encaminha-o para `/auth/ligar`. E quando o `seguinte` se perde pelo caminho, o
destino sai do `type` do link (`magiclink`, `invite`, `signup`, `recovery`):
vai sempre dar a `/definir-password`. **A configuração continua a ser
precisa** — isto é a rede, não o chão.

O fornecedor é o Brevo, e já tropeçámos numa armadilha dele: `525 5.7.1
Unauthorized IP address`. O Brevo só aceita envios de endereços IP autorizados,
e isso vem ligado de origem nas contas novas. Os IP de saída do Supabase não
são fixos nem publicados, por isso a lista de autorizados não serve de nada
aqui — o que resolve é desligar o bloqueio automático em **Settings →
Security → Authorized IPs**.

### A visão de cliente

A conta de cliente é quase toda de leitura, e é a RLS que a fecha: as consultas
não levam filtro por pessoa em lado nenhum. O cliente escreve em dois sítios, e
só nesses: as **notas do cavalo**, e o **«Já paguei»** — que é uma afirmação à
espera de confirmação, não um lançamento (ver a decisão em cima). O que era preciso limar não era a
segurança, era a linguagem — o cliente estava a ver as páginas da gestão com os
dados dele lá dentro.

**Quem paga não recebe.** Do lado do cliente a palavra é **pagamento**;
«recebimento» é a palavra da gestão e fica do lado dela. `/pagamentos` é a
conta-corrente vista de quem paga — por pagar, já pago, e cada mês com os
pagamentos por baixo — e ocupa na barra de baixo o lugar que «Pessoas» lhe
deixa livre. `/financeiro/recebimentos` é só da gestão (`exigirGestao`).

O resto do que saiu, e porquê:

- **Boxes** passou a `e_equipa()` e **Contratos de penso** a `e_gestao()`: ao
  cliente eram duas entradas de menu que abriam ecrãs quase vazios.
- A listagem de cavalos esconde a coluna **Proprietário** (era o nome dele
  repetido em cada linha) e os filtros de regime (nunca lhe devolviam nada) a
  quem não é da cavalariça.
- No painel, «contacte a gestão para regularizar» era um beco sem saída; agora
  há o caminho para os pagamentos.

Falta ainda, e é trabalho da Fase 4: marcar-se a si próprio nos treinos de
Horseball, e corrigir o telefone ou a morada da própria ficha.

**Quem paga não lança.** Em `/pagamentos`, cada mês ou encargo em falta tem um
botão **«Já paguei»** — e o texto diz isso e não «Pagar», porque o que ele faz
é avisar o centro. A linha passa a «a aguardar confirmação» (nem paga, nem por
avisar), com saída para retirar enquanto ninguém decidiu. Esta aplicação não
movimenta dinheiro e não emite documento nenhum; o botão di-lo ali mesmo.

### Listas com saída: raças e pelagens

`<SelectorComOutro>` é uma lista de opções cuja última entrada abre uma caixa
de texto. A lista não pode ser fechada — aparece sempre uma raça que ninguém
previu — mas também não pode ser texto livre, senão o mesmo lusitano acaba
escrito de quatro maneiras e a pesquisa deixa de servir.

O que é escrito à mão viaja em `<campo>_nova`, e `opcaoOuNova()` em
`lib/accoes/cavalos.ts` é que decide qual dos dois vale. Quando vem da caixa
de texto, a acção acrescenta-o a `opcoes_cavalo` depois de gravar o cavalo —
é isso que faz a opção ficar lá para a próxima. Um duplicado (23505) é
ignorado de propósito: significa que já lá está, que é o que se queria.

`/cavalos/opcoes` existe por causa do engano. Sem ela, corrigir um «Lusitno»
que entrou na lista obrigava a ir ao painel do Supabase. Mudar o nome muda-o
também nos cavalos; tirar da lista não apaga nada, só deixa de ser oferecido.

### Importar contactos do telemóvel

`<ImportarContacto>` preenche nome, telefone, email e morada no formulário de
nova pessoa. Há dois caminhos porque só um funciona em cada lado, e isto não
vai mudar tão cedo:

- **Android:** `navigator.contacts.select()` abre o selector do sistema. A
  aplicação recebe só os contactos escolhidos, nunca a lista toda, e não há
  permissão permanente a pedir.
- **iPhone e computador:** a Apple nunca implementou essa API, e no iOS todos
  os browsers são Safari por dentro. O caminho é o cartão de contacto —
  «Partilhar contacto → Guardar em Ficheiros» dá um `.vcf`, lido por
  `lib/vcard.ts`.

O botão do selector **só aparece onde funciona**, e a detecção corre num
`useEffect` — no servidor não há `navigator`, e desenhá-lo logo dava uma
hidratação diferente.

`lib/vcard.ts` não é um leitor completo da norma, mas aguenta o que os
telemóveis produzem: linhas dobradas das duas maneiras (a da norma, com espaço
à frente, e a do quoted-printable, com um `=` no fim e sem espaço),
`ENCODING=QUOTED-PRINTABLE` para os acentos, prefixos de grupo da Apple
(`item1.TEL`) e vários cartões no mesmo ficheiro. **Nada é escrito por cima:**
só se preenchem os campos vazios, e o aviso diz em quais não se mexeu.

### O financeiro: duas perguntas, e não seis páginas

A secção tinha seis entradas de menu e nenhuma delas dizia por onde começar.
Três problemas, e o que se fez a cada um:

- **«Conta» queria dizer duas coisas.** `contas` são a caixa e os bancos do
  centro; «conta-corrente» era o que um cliente deve. Agora o menu diz
  **«Caixa e bancos»**, e a página do cliente chama-se **«Pensos e encargos»**.
  A tabela e as rotas não mudaram — isto é vocabulário, não esquema.
- **Havia três sítios a mostrar dinheiro a entrar** (Recebimentos, Pensos do
  mês, e a conta-corrente de cada cliente) e nenhum respondia a «quem me
  deve»: «Pensos do mês» mostrava **um mês de cada vez**, e quem deve três
  meses é precisamente quem interessa ver; e **ignorava os encargos**, que são
  dinheiro que o centro adiantou ao ferrador. `/financeiro/por-receber`
  substitui-a: uma linha por **cliente**, pensos e encargos somados, de todos
  os meses, ordenada **pelo mais antigo** — porque quem está há mais tempo a
  dever é quem precisa do telefonema, e não quem deve mais euros por acaso.
  A geração das mensalidades do mês mudou-se para o fundo dessa página, onde
  se vê quantas faltam.
- **Fornecedores e categorias ocupavam duas das seis entradas**, e mexe-se
  nelas uma vez por ano. Passaram para `/financeiro/definicoes`, que é uma
  entrada só. As duas páginas ganharam `voltar` para lá, que no telemóvel é o
  único caminho de regresso.

`/financeiro` é a porta: as duas perguntas em grande — **quem me deve**, **o
que gastei** — e os saldos por baixo. O aviso no topo não é decoração, é o
contrato desta secção: **isto é um livro de registo**, a aplicação não liga a
nenhum banco, não movimenta dinheiro nenhum, e o que lá está serve para
conferir contra o extracto e não para o substituir. Foi decisão explícita do
cliente, e repete-se em `/financeiro/contas`.

`ItemNavegacao.exacto` existe por causa disto: sem ele, `/financeiro` acendia
no menu em todas as páginas que lhe ficam por baixo.

### Cobrança de pensos

`/pessoas/[id]/pensos` é a página de um cliente: o que deve, o que já pagou e
como pagou cada mês. `/financeiro/por-receber` responde «quem me deve» para
todos; esta responde à pergunta do cliente ao longo dos meses, que é a que se
faz à mesa da cobrança. O indicador «Em dívida» soma **pensos e encargos** —
contar só os pensos dizia «tudo em dia» a quem devia duas ferrações —, mas o
botão «Receber tudo» continua a ser só das mensalidades, porque é
`mensalidade_id` que liga cada euro ao mês.

O recebimento é feito ali, por `receberPensos()` em `lib/accoes/financeiro.ts`
— método em pastilhas, data, conta, confirmar. O formulário completo de
recebimento continua a existir para o resto (imputar a outra pessoa, número do
documento fiscal emitido lá fora, notas).

Duas coisas a não mudar sem pensar:

- **Uma mensalidade, um recebimento**, mesmo quando três meses vêm na mesma
  transferência. É `mensalidade_id` que liga cada euro ao mês a que respeita, e
  é isso que faz a trigger acertar o estado de cada mensalidade.
- **O que falta é relido da base dentro da acção**, nunca aceite do formulário:
  entre abrir a página e carregar no botão pode ter entrado outro pagamento.

### Interface no telemóvel

A aplicação usa-se de telemóvel dentro da cavalariça e de computador no
escritório. As duas coisas que mais custaram a acertar:

- **A navegação de baixo.** `<BarraInferior>` mostra quatro secções mais
  «Mais». As quatro saem dos itens de `SECCOES` marcados `principal: true`,
  pela ordem em que lá estão e depois de filtrados pelo perfil — por isso o
  cliente, que não vê «Pessoas», recebe «Pagamentos» nesse lugar. O que
  existia antes era uma fila de doze pastilhas com deslize horizontal: viam-se
  três, e não havia como adivinhar que existiam mais nove. O `<main>` leva
  `pb-24` porque a barra é fixa.
- **O telemóvel ampliava a página sozinho, e a culpa era dos campos.** O
  Safari do iOS amplia sempre que o foco cai num campo com **menos de 16px** —
  e todos os campos eram `text-sm`, ou seja 14px. Tocar num campo ampliava,
  sair do campo deixava a página ampliada, e quem preenchia um formulário
  passava o tempo a afastar com os dedos. `BASE_CAMPO` em
  `components/ui/campos.tsx` leva por isso `text-sm pointer-coarse:text-base`:
  16px nos ecrãs de toque, 14px no rato, e a altura `h-10` dá exactamente para
  os dois. **Não baixes isto abaixo de 16px em ecrãs de toque.**
- **`touch-action: manipulation` no `body`** tira ao toque duplo a função de
  ampliar, e mais nada — dois toques seguidos num botão são um engano
  frequente com luvas, e deixavam a página ampliada. De passagem tira o atraso
  de ~300 ms que o browser impunha a cada toque.
- **Ampliar com dois dedos continua a funcionar, e tem de continuar.** É como
  se lê uma factura digitalizada ou a marca de um cavalo numa fotografia, e é
  o que permite a quem vê mal usar isto. `user-scalable=no` seria pior do que
  o problema — e **no iPhone nem sequer funcionaria**: o Safari ignora essa
  definição desde o iOS 10, de propósito, por acessibilidade. A maneira certa
  de não haver zoom acidental é a de cima: campos a 16px e o duplo toque
  desarmado.
- **As tabelas deixam de ser tabelas abaixo de `sm`.** Cada linha passa a
  cartão, com o nome da coluna à esquerda de cada valor. O nome da coluna vem
  do `rotulo` do `<Td>`: **numa listagem nova, todos os `<Td>` levam `rotulo`
  excepto um** — o que não leva é tratado como título do cartão, sobe para
  cima de tudo (`order-first`) e é onde vai a `<LigacaoFicha>`. Sem isto as
  listagens tinham seis colunas e obrigavam a deslizar para o lado.

### `lib/tipos-bd.ts`

Escrito à mão porque o projecto arranca sem um Supabase ligado. Inclui os
`Relationships` de cada tabela — sem eles os `select` aninhados
(`select('*, pessoas(nome)')`) não passam na verificação de tipos.

Com um projecto ligado pode ser regenerado:

```bash
npx supabase gen types typescript --project-id <ref> > lib/tipos-bd.ts
```

Se o fizeres, confirma que os `select` aninhados continuam a compilar.

---

## 6. Trabalhar no projecto

```bash
npm install
cp .env.example .env.local     # arranca com valores de exemplo
npm run dev

npm run build                  # compila e verifica tipos
npm run lint
npm run testar                 # testes das funções puras (QR de faturas, iCal)
./scripts/validar-esquema.sh   # migrações + seed + testes de RLS
```

`npm run testar` corre os testes de funções puras (`lib/**/*.test.ts`) com o
executor do Node e o `--experimental-strip-types`, sem compilar nada.

`validar-esquema.sh` arranca um PostgreSQL descartável, aplica o arremedo do
Supabase (`supabase/tests/00_shim_supabase.sql`), corre todas as migrações e
executa `supabase/tests/01_rls.sql`. Não precisa de Docker nem de rede.
**Corre-o sempre que mexeres numa migração.**

Sem chaves reais no ambiente, a aplicação mostra a página de instruções em vez
de rebentar — ver `lib/supabase/configuracao.ts`.

---

## 7. PWA

Manifesto em `app/manifest.ts`, service worker em `public/sw.js`, registado por
`components/registar-service-worker.tsx` (só em produção).

O service worker trata também das **notificações**: o `push` mostra o aviso
(com `tag` para dez notas do mesmo cavalo não serem dez notificações
empilhadas) e o `notificationclick` abre o sítio exacto, reaproveitando uma
janela já aberta em vez de abrir outra.

O service worker faz **rede primeiro** nas navegações, com cache e
`public/offline.html` como recurso final; ficheiros com hash em `/_next/static/`
são servidos da cache. **Não guarda escritas em fila**: um lançamento feito
offline seria uma promessa impossível de cumprir sem conflitos. Em vez disso
`components/indicador-ligacao.tsx` avisa quando não há rede.

Ícones: `node scripts/gerar-icones.mjs`.

---

## 8. Faseamento

Implementadas: **Fase 1** (cadastro), **Fase 2** (financeiro e dashboard) e
**Fase 3** (eventos: aulas, treinos de Horseball, competições, convocatórias,
presenças, avisos e subscrição de calendário).

Fora da Fase 3, por decisão: ligar cada evento ao recebimento que o pagou.
`eventos.recebimento_id` existe e está por usar — é trabalho da Fase 4, e
misturá-lo com o planeamento atrasava o quadro do dia, que era o que urgia.

Por implementar:

- **Fase 4 — Conta-cliente.** Falta a marcação de treinos de Horseball pelo
  próprio. O resto está: a gestão convida (ver «Quem entra, e como»), o cliente
  entra, vê as suas próximas marcações, os seus cavalos e o que deve; e a
  cobrança vive em `/pessoas/[id]/pensos`. Gancho que falta usar:
  `pessoa_papeis.jogador_horseball`.
- **Fase 5 — Stocks e saúde.** Ração e palha com alertas, vacinas,
  veterinário, relatórios. A **ferração** já está feita (pedida à parte, fora
  da ordem das fases): `ferracoes` e `v_ferracao_cavalos`, na ficha do cavalo
  e numa coluna da listagem.

Não comeces uma destas fases sem pedido explícito.

---

## 9. Importação de histórico

O cliente não tem acesso ao sistema que usa hoje. A entrada inicial é manual e os
formulários estão feitos para isso. Uma importação pode vir depois — não
condiciones decisões por causa dela.
