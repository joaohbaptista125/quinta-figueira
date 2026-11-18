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
| `…090100_fase1_cadastro.sql` | `pessoas`, `pessoa_papeis`, `cavalos`, `boxes` (removida depois), `contratos_penso` |
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
| `…20261115100000_confirmacao_de_presenca.sql` | `evento_participantes.confirmacao` + trigger de carimbo |
| `…20261115110000_quem_paga_o_ferrador.sql` | `cavalos.ferrador_pago_por` + `ferracoes.pago_em` |
| `…20261116090000_paddocks.sql` | `paddocks`, `paddock_ocupacao`, e `drop table boxes` |
| `…20261116120000_cavalo_em_aprovacao.sql` | `cavalos.aprovado_em` + `carimbar_cavalo_proposto` + RLS da proposta |
| `…20261118090000_acesso_e_perfis.sql` | `ligar_ficha_a_conta_existente` + `travar_perfil_de_administrador` |
| `…20261118100000_conversa_de_equipa.sql` | os membros escrevem na conversa + `carimbar_autor_do_aviso` |
| `…20261118140000_dados_reservados_da_pessoa.sql` | `pessoas_reservado` — NIF, morada e notas saem de `pessoas` |
| `…20261118160000_reaccoes_no_chat.sql` | `aviso_reaccoes` + `carimbar_autor_da_reaccao` |
| `…20261118170000_tratador_so_consulta.sql` | paddocks e ferrações passam a `e_instrutor_ou_gestao()` |

**Nunca alteres o esquema pelo painel do Supabase.** Cria uma migração nova e
actualiza `lib/tipos-bd.ts` na mesma alteração.

**As migrações aplicam-se sozinhas** pelo workflow `.github/workflows/migracoes.yml`:
entra uma migração no `main`, corre `supabase db push --remote --yes`.

**O CLI está fixado numa versão, e isso custou uma avaria para se aprender.**
Com `version: latest`, o salto do CLI para a v3 trocou o alvo por omissão dos
comandos para a stack **local**: o `migration list` falhou a tentar ligar-se a
127.0.0.1, o `db push` foi saltado por depender dele, e a Vercel publicou
código novo contra uma base sem as colunas — exactamente a janela que este
workflow existe para fechar. A v3 também passou a **pedir confirmação** antes
de tocar numa base de produção, e sem terminal para responder o `db push`
recusa-se — daí o `--yes`. Daí também o **`--remote` explícito** em todos os
comandos e a versão presa. Actualiza-se à mão, a ver o que mudou, e não a
meio de uma publicação. Fica em silêncio
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

**As boxes saíram e os paddocks entraram, e isso apagou dados de propósito.**
Pedido explícito do centro: a secção das boxes não era usada, e a pergunta
real de quem chega de manhã à cavalariça é outra — **quem já saiu, e para
onde**. `drop table public.boxes` está na migração dos paddocks; o que lá
estivesse escrito perdeu-se, e fica registado que foi decisão e não descuido.

**Um paddock leva vários cavalos, e por isso a ocupação é uma tabela.** É o
contrário da box, em que `boxes.cavalo_id` era único porque só cabia um.
`paddock_ocupacao` (paddock × cavalo × dia) é o que sustenta o quadro.

- **A ocupação vive à parte de `cavalos`.** `cavalos` só se edita com
  `e_gestao()`, e quem larga os cavalos está na cavalariça. Uma coluna em
  `cavalos` obrigava a abrir a tabela inteira, ou a mais uma trigger a travar
  colunas. **Escrever é de `e_instrutor_ou_gestao()`** — era de `e_equipa()`,
  e mudou; ver «O tratador consulta» na secção da segurança, que diz o que
  isso contraria.
- **Só interessa hoje, e a `data` existe para isso.** Foi o que o centro
  pediu, e não há ecrã nenhum de histórico. A data serve para o quadro **se
  esvaziar sozinho à meia-noite**: sem ela, a largada de ontem ficava no ecrã
  até alguém a apagar à mão, e um quadro que mente de manhã é pior do que não
  haver quadro. Não há selector de datas em lado nenhum — convidaria a
  escrever no dia errado.
- **Um cavalo num paddock de cada vez, por dia** (`unique (cavalo_id, data)`).
  Não é regra de gestão, é aritmética. Por isso o selector de «largar» só
  oferece os cavalos que ainda não saíram: oferecer os outros era dar um botão
  que só sabe dar erro.
- **Largar avisa o dono; recolher não avisa ninguém.** O dono já soube que o
  cavalo saiu, e um segundo aviso a dizer que voltou é a maneira certa de
  estes avisos passarem a ser ignorados. O `agrupar` leva o cavalo e o dia,
  para uma mudança de campo substituir a notificação em vez de empilhar duas.
- `supabase/tests/12_paddocks.sql` prova os cinco lados, incluindo que a
  tabela `boxes` já não existe.

**O cliente inscreve o cavalo; a gestão aprova.** O acesso é dado muitas vezes
antes de a ficha do cavalo existir — alguém chega ao centro, recebe o convite,
entra, e não tem nada para ver. `cavalos.aprovado_em` resolve-o: o cliente
escreve a ficha e ela fica **por aprovar** até a gestão lhe tocar.

- **É uma data e não um estado.** Responde a «está aprovado?» e «desde
  quando?» com uma coluna só. É o desenho de `pessoas.acesso_confirmado_em` e
  de `ferracoes.pago_em`.
- **Não há «recusado».** Recusar apaga a ficha e manda o motivo ao cliente —
  por isso **o motivo é obrigatório**, como na recusa de um pagamento
  declarado: é a única coisa que ele vai ler, e sem ela o cavalo que acabou de
  inscrever desaparecia sem explicação. Guardar fichas recusadas enchia a
  listagem de cavalos que não existem no centro.
- **A RLS decide linhas, não colunas, e aqui era preciso travar colunas.** Um
  cliente que pudesse escrever `aprovado_em` aprovava-se a si próprio; um que
  escolhesse `proprietario_id` inscrevia um cavalo em nome de outro. Quem o
  limita é a trigger `carimbar_cavalo_proposto`, que força proprietário,
  regime (`penso`) e estado — e volta a forçá-los em cada correcção. Como nas
  outras, tem o travão de `pg_trigger_depth() = 1`.
- **Sem sessão nada disto se aplica**: o seed e as migrações correm sem
  `pessoa_actual_id()`, e aí a ficha nasce aprovada — senão o seed partia
  contra `cavalos_penso_exige_proprietario`.
- **Qualquer pessoa pode propor um cavalo seu**, não só quem tem perfil de
  cliente: um instrutor também pode ter um cavalo a penso. O que se mantém é
  a garantia que interessava — ninguém de fora da gestão cria um cavalo **do
  centro** nem mexe num que já existe. Os testes 01 e 13 provam as duas
  coisas.
- **Enquanto está pendente, o dono corrige o que escreveu**; depois de
  aprovada, a correcção passa a ser uma nota na ficha, que deixa rasto e é o
  caminho que já existia.
- **Uma ficha por aprovar não é um cavalo do centro**: `cavalosActivos()` em
  `lib/consultas.ts` filtra-a, por isso não aparece para contratos de penso,
  despesas nem convocatórias.
- O que substitui a notificação é `<CavalosPorAprovar>` no painel; o aviso a
  `pessoasDaGestao()` é só o atalho.
- `supabase/tests/13_cavalo_em_aprovacao.sql` prova cada um destes lados.

**A ficha e a conta ligam-se nos dois sentidos, e durante muito tempo só num.**
`ligar_pessoa_ao_criar_utilizador` corre em `auth.users`, por isso só liga a
ficha **no instante em que a conta nasce**. Isso cobre o caminho previsto —
ficha, convite, link — e falha em todos os outros: quem criou conta antes de
alguém lhe escrever a ficha, e quem teve a ficha escrita com o email trocado.
Nesses casos a ficha ficava para sempre com `auth_user_id` a null e a pessoa
via «a sua conta está criada mas ainda não está associada a nenhuma ficha»,
mesmo com ficha de gestor à frente dela — e não havia saída sem ir ao painel
do Supabase. `ligar_ficha_a_conta_existente` é a trigger simétrica, em
`pessoas`. **Se mexeres numa, mexe na outra.**

- `lower(btrim(...))` dos dois lados: em `pessoas` a restrição do email já
  recusa espaços à volta, mas `auth.users` é do Supabase e não dá essa
  garantia.
- **Uma conta já presa a outra ficha não se rouba** (`auth_user_id` é único):
  sem essa condição a gravação rebentava com 23505 em vez de simplesmente não
  ligar. O caso real é a ficha A apanhar a conta, mudarem-lhe o email, e uma
  ficha B nascer com o endereço antigo.
- A migração traz o `update` que liga as que já tinham ficado penduradas.

**NIF, morada e notas vivem fora de `pessoas`, e a razão é a de sempre.**
O centro pediu que o instrutor e o tratador não vissem o NIF nem a morada de
toda a gente, nem as notas internas que a gestão escreve nas fichas.

**Escondê-las no `select` não chegava.** A RLS decide **linhas, não colunas**:
`pessoas_ler` deixa a equipa ler a ficha, e a partir daí todas as colunas dela
vêm no mesmo pedido — deixar de as pedir escondia-as do ecrã e de mais nada.
Privilégios por coluna no Postgres são por **papel da base**, e no Supabase
toda a gente autenticada partilha o papel `authenticated`, por isso também não
servem. O que resta é mudar as colunas de tabela, que é exactamente o que
`calendarios` já fazia pelo mesmo motivo.

`pessoas_reservado` é 1:1 com `pessoas`, `on delete cascade`. Lê-a a gestão, e
cada pessoa a sua; escreve-a a gestão.

- **Só há linha para quem tem alguma coisa.** `guardarReservado()` em
  `lib/accoes/pessoas.ts` apaga a linha quando os três campos ficam vazios —
  uma linha vazia por ficha não serve nada.
- **A ficha tem de ir buscá-la.** Enquanto `<CamposPessoa>` as lia de `pessoa`
  e a página não as carregava, o formulário abria com os campos vazios e
  **gravar apagava-os**. Se acrescentares um campo reservado, acrescenta-o nos
  dois sítios.
- A pesquisa por NIF em `/pessoas` passa pela tabela nova e **só para a
  gestão** — a quem não é, a RLS devolvia zero de qualquer maneira.
- O teste do NIF em `01_rls.sql` apontava para `pessoas` e passou a **passar
  por acidente** depois da mudança: `afirmar_recusa` apanha também o erro de
  «coluna não existe». Aponta agora para a tabela certa — é o género de coisa
  a verificar sempre que uma coluna muda de casa.

**O perfil de administrador é só do administrador, e isto era um buraco.**
`pessoas_gerir` é `e_gestao()` e vale `for all`: um **gestor podia escrever
qualquer coluna de qualquer ficha**, `perfil` incluído. Punha-se a si próprio
a `admin`, ou punha o admin a `cliente`. O segundo é o que faz mais estrago e
não é óbvio: `reclamar_primeiro_admin()` só se recusa **enquanto houver um
admin activo**, por isso tirar o último não deixa o centro sem dono — deixa-o
à mercê do primeiro utilizador autenticado que a chamar.

A RLS decide linhas e o que era preciso travar era uma coluna, por isso quem o
faz é `travar_perfil_de_administrador`, como nas outras.

- Dar ou tirar `admin` (em INSERT ou UPDATE) exige `e_admin()`.
- **O último administrador activo não se tira** — nem mudando-lhe o perfil,
  nem desactivando-o, nem apagando a ficha, e nem pelo próprio.
- **Um gestor continua a tratar dos outros perfis** (cliente, instrutor,
  tratador). Só o de administrador é que lhe sai das mãos.
- Sem nenhum admin activo a trigger deixa passar: aí quem manda é
  `reclamar_primeiro_admin()`, que tem as suas próprias guardas.
- `supabase/tests/14_acesso_e_perfis.sql` prova os dois lados.

**As nossas recusas têm de chegar ao ecrã.** O 42501 vem de dois sítios: do
Postgres, quando a RLS barra (inglês técnico que não diz nada a ninguém), e
das nossas triggers e funções, que o usam de propósito para explicar o motivo
em português. `traduzirErro` trocava ambos por «não tem permissão para esta
operação» — e deitava fora a única coisa útil. Agora distingue-os pelo início
da mensagem. Isto também desbloqueou a mensagem de
`confirmar_pagamento_declarado`, que estava a ser engolida desde que existe.

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

**Convoca-se no próprio formulário de marcação**, e não só depois na ficha.
«Terça às 18:30, estes quatro» é uma coisa só na cabeça de quem marca, e eram
três passos: marcar, entrar no evento, convocar um a um.
`<EscolherConvocados>` é uma lista de caixas de visto com pesquisa — com ~80
fichas, sem filtro não se usa num telemóvel. **Quem está marcado continua
marcado quando o filtro o esconde** (viaja em campos escondidos): perder uma
escolha já feita ao escrever na pesquisa seria pior do que não ter pesquisa.
Como a equipa, entra em **todas** as marcações da série; os cavalos
atribuem-se depois, na ficha, que é onde se vêem os pares.

**O aviso de convocatória ao marcar é um por pessoa, não um por marcação.**
Seis pessoas em oito terças seriam quarenta e oito notificações, e uma
aplicação que faz isso ensina a desligá-las. `avisarDaMarcacao()` manda um
aviso sobre a primeira marcação, a dizer quantas semanas são.

**Confirmar não é estar presente, e as duas coisas não partilham coluna.**
`evento_participantes.estado` (convocado/presente/faltou/dispensado) é o que a
equipa regista **depois**, e é o registo de assiduidade do centro.
`confirmacao` (sem_resposta/vai/nao_vai) é o que o atleta diz **antes**, e é
uma intenção. Juntá-las daria ao atleta a caneta para escrever a própria
presença e, do outro lado, faria desaparecer a resposta dele no momento em que
a equipa marcasse as presenças. É o desenho de `pagamentos_declarados`: o que
a pessoa afirma vive ao lado do que o centro regista, nunca por cima.
`supabase/tests/10_confirmacao_presenca.sql` prova as duas direcções.

- **A RLS decide linhas, não colunas.** Deixar o atleta responder deixava-o
  também pôr-se a `presente` e trocar de cavalo, porque é a mesma linha. Quem
  o limita é a trigger `carimbar_confirmacao_do_participante`, que repõe tudo
  o que não seja a resposta — e carimba `confirmado_em`.
- **`pg_trigger_depth() = 1` nessa trigger não é adorno.** Sem isso o travão
  apanhava também as cascatas: cancelar um evento faz
  `propagar_janela_do_evento` anular a janela dos participantes, e o travão
  desfazia-o — o cavalo nunca mais ficava livre. Foi o
  `supabase/tests/02_eventos.sql` que o apanhou.
- **O atleta só tem `update`.** Convocar e desconvocar continuam a ser de quem
  planeia: um atleta que se desconvocasse a si próprio desaparecia da lista
  que o instrutor leva para o picadeiro, e «não vou» tem de ficar à vista.
- **Dizer «não vou» não liberta o cavalo nem cancela nada.** Quem decide se a
  sessão se faz, e com que par aluno↔cavalo, é quem a dá. Isto é informação a
  chegar a tempo, não uma desmarcação automática.
- **Um «não vou» avisa o responsável do evento** (ou a gestão, se não houver):
  é esse o ponto todo. Um «vou» é o esperado e não interrompe ninguém.
- **O motivo da ausência aparece na convocatória, e não só na notificação.**
  Ia na notificação e morria aí: quem abrisse a aplicação depois via «Não
  vai» e mais nada, e tinha de ir perguntar. `<Convocatoria>` mostra-o por
  baixo da linha da pessoa — o motivo só serve a quem está a decidir se a
  sessão se faz.

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
o formulário sugere seis semanas e deixa mudar. **Escrever era de `e_equipa()` e
hoje é de `e_instrutor_ou_gestao()`** — o motivo de então (quem recebe o
ferrador na cavalariça é o tratador) está em «O tratador consulta», na secção
da segurança, com o que se perdeu ao mudar. O
custo que lá fica é nota do que foi combinado; a despesa lança-se no
financeiro, imputada ao cavalo.

**Quem paga o ferrador é do cavalo, e define-se uma vez.** Há dois arranjos
na Quinta da Figueira: ou o centro paga ao ferrador e recobra, ou o dono trata
directamente com ele e paga-lhe na hora. O segundo não tinha onde viver — e o
centro pode nem saber que a visita aconteceu, porque quem a marca é o dono.
`cavalos.ferrador_pago_por` ('centro' | 'proprietario') decide, e **não se
pergunta a cada ferração**: foi decisão do cliente, e segue o que já estava
escrito — depende do cliente, não depende do dia.

- Num cavalo de `proprietario`, **o dono regista a ferração** (escreve o nome
  do ferrador) e marca `pago_em`. É data e não booleano: «pagou a 12/11»
  responde à pergunta seguinte sem custar um campo a mais, porque quem marca
  está a marcar hoje.
- Nesse caso **o visto de «pôr na conta do proprietário» não aparece**, e
  `cobrarAoProprietario()` recusa mesmo que apareça: criar ali um encargo era
  cobrar-lhe o que ele já pagou.
- A escrita do dono é limitada pela RLS aos cavalos dele com esse arranjo.
  **Sem `delete` para ele, de propósito**: a ferração também sustenta o
  calendário do ferrador do centro, e apagá-la tirava ao tratador uma linha de
  que ele depende. Um engano corrige-se editando.
- `guardarCavalo` devolve o campo a `centro` quando não há proprietário ou o
  regime não é penso — um cavalo sem dono não tem quem pague directamente.
- `supabase/tests/11_quem_paga_o_ferrador.sql` prova os quatro lados.

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

**Avisos num evento; conversa numa equipa.** `avisos` pertence a um evento OU
a uma equipa, nunca aos dois — e desde o pedido do centro as duas coisas
comportam-se de maneira diferente.

**No evento é um aviso**, de um para muitos: quem planeia escreve, quem está
convocado lê — no quadro do dia e na descrição do evento no calendário do
telemóvel. `e_instrutor_ou_gestao()`, como sempre foi.

**Na equipa é o Chat, e qualquer membro escreve.** Isto **contraria a
decisão anterior** de não haver conversa nenhuma na aplicação, e foi pedido
explicitamente. O motivo de então continua de pé e é o que molda isto: um
sítio para escrever sem avisos fiáveis fica deserto, com as conversas a
voltarem para o WhatsApp. Por isso a abertura da escrita e a notificação
**entraram juntas** — `avisarAEquipa()` em `lib/accoes/eventos.ts`. Sem ela
não valia a pena abrir nada.

- **Escrever sim, apagar não.** É a regra de `notas_cavalo`: ninguém reescreve
  o que já foi dito, nem o próprio autor. Só a gestão e os instrutores apagam,
  para o caso de alguém escrever o que não devia.
- **O autor é carimbado pela base** (`carimbar_autor_do_aviso`), e já não vem
  da aplicação. Enquanto só a gestão escrevia era pouco interessante; com os
  membros a escrever, era deixar a aplicação falar em nome de outro.
- **Não há tempo real**, e a página di-lo. As mensagens aparecem ao carregar.
  O que as faz chegar a tempo é a notificação — quem escreveu não é avisado de
  si próprio, e o `agrupar` leva a equipa, para cinco mensagens seguidas se
  substituírem em vez de empilharem cinco notificações.
- `supabase/tests/15_conversa_de_equipa.sql` prova a fronteira: um membro
  escreve na equipa dele e **só** nela, não publica avisos em eventos, não
  apaga nem corrige, e não lê a conversa de uma equipa onde não está.

**Reagir com um emoji é o que impede o chat de se encher de «ok».**
`aviso_reaccoes` (mensagem × pessoa × emoji, e é essa a chave primária). Numa
conversa de equipa a resposta mais frequente é «li e concordo», e escrevê-la
são cinco mensagens a empurrar a conversa para cima — e, pior, **cinco
notificações** no telemóvel de toda a gente.

- **Uma reacção não avisa ninguém**, de propósito. É a regra do «recolher» nos
  paddocks e do aviso de mensalidade: o que não é urgente não interrompe. Um
  polegar a gerar uma notificação era a maneira mais rápida de estes avisos
  passarem a ser ignorados — e são eles que fazem a conversa funcionar, porque
  não há tempo real.
- **A reacção tira-se, ao contrário da mensagem.** «Ninguém reescreve o que já
  foi dito» vale para o que foi dito; uma reacção é um interruptor. Daí haver
  `delete`, e **só da própria** — nem a gestão tira a de outra pessoa, que
  seria falar em nome dela. Uma mensagem imprópria apaga-se inteira, e as
  reacções vão com ela pelo `on delete cascade`.
- **A política não repete a de `avisos`.** Um `exists` sobre `avisos` dentro da
  política corre com a identidade de quem consulta, por isso a RLS de `avisos`
  aplica-se lá dentro: quem não lê a mensagem não vê nem dá reacções. Repetir
  as condições era deixar duas regras a divergir.
- **A lista de emojis é fechada** (`EMOJIS_COMUNS`, em `lib/reaccoes.ts`), ao
  contrário das raças: um emoji que falte não impede ninguém de dizer o que
  quer, porque a caixa de texto está logo por baixo. Seis cabem numa linha no
  telemóvel sem selector nenhum. A lista vive fora da Server Action para o que
  o ecrã oferece ser exactamente o que a acção aceita — a base só trava o
  comprimento.
- **O ecrã muda no toque, não na resposta** (`useOptimistic` sobre
  `alternarNaLista`, que é pura e testada por ser ela que decide o que se vê
  nesse instante). Com o arranque a frio, uma reacção que só aparecesse depois
  da ida ao servidor eram segundos a olhar para um emoji que não reagiu.
- **São só do chat**, e isso é escolha: a RLS deixa reagir a qualquer mensagem
  legível, mas num aviso de evento uma fila de emojis não acrescenta nada a
  quem lê o quadro do dia. Oferecê-las lá é passar `meuNome` também nesse ecrã.
- **Vêm numa consulta à parte, e nunca aninhadas nos avisos.** Estiveram
  aninhadas, e o preço só se viu quando correu mal: um erro nas reacções não
  dava «as reacções falharam», dava a **ficha da equipa inteira em erro** —
  sem membros, sem chat e sem treinos. O erro da consulta separada é engolido
  de propósito, como em `avisar()`: sem reacções a conversa continua a ler-se
  e a escrever-se, que é o que lá importa. **Não voltes a metê-las no `select`
  da equipa.**
- `supabase/tests/16_reaccoes_no_chat.sql` prova cada um destes lados.

**Para conversa geral continua a não haver nada**, e não construas sem pedido
explícito: o raciocínio acima só se aguenta num grupo pequeno que existe para
falar entre si.

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

| | pessoas | cavalos / paddocks / agenda | contratos | financeiro |
|---|---|---|---|---|
| admin, gestor | tudo | tudo | tudo | tudo |
| instrutor | lê nome e contacto | lê e escreve | **não** (têm valores) | **não** |
| tratador | lê nome e contacto | **só lê** — ver abaixo | **não** | **não** |
| cliente | só a sua | só o que é dele | só os dele | só os recebimentos dele |

**O tratador consulta, e isso contraria duas decisões registadas.** Pedido
explícito do centro: o perfil de tratador deixou de escrever nos **paddocks** e
nas **ferrações**, que passaram de `e_equipa()` para `e_instrutor_ou_gestao()`.
O que estava escrito era que «quem larga os cavalos é o tratador» e que
«obrigá-lo a pedir à gestão era a maneira certa de o registo não existir» — e
**esse risco não desapareceu por a regra ter mudado**: se o quadro dos paddocks
deixar de ser preenchido de manhã, ou as ferrações deixarem de ser lançadas, é
aqui que se vem ver porquê. Ler não mudou: vê o quadro, a agenda e o histórico
de ferração de cada cavalo, que é para isso que entra na aplicação. O resto da
agenda — eventos, convocatórias, presenças e avisos — já era de
`e_instrutor_ou_gestao()`.

**O que fica de fora, de propósito:** `notas_cavalo` e o chat de equipa. A nota
não é registo do centro, é a conversa de um cavalo — o dono pergunta e a
cavalariça responde, e fechá-la ao tratador tirava a resposta a quem muitas
vezes é o único que sabe dar. O chat depende de ser membro da equipa, não do
perfil. `supabase/tests/17_tratador_so_consulta.sql` prova os quatro lados.

**O instrutor não toca em dinheiro nem em fichas, e já não tocava.** Todas as
páginas de `/financeiro` chamam `exigirGestao()` e a RLS por baixo é
`e_gestao()`; `pessoas_gerir` também é `e_gestao()`, por isso `/pessoas` é para
ele uma listagem de leitura — nome, contacto e papéis, sem a coluna de pensos e
sem «Nova pessoa» — e a ficha mostra um cartão «Contactos» em vez do
formulário. NIF, morada e notas internas já não vivem em `pessoas` de todo.

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
    page.tsx      painel, com uma variante por perfil
    agenda/       quadro do dia, e a ficha de cada evento
    equipas/      grupos de Horseball
    conta/        perfil e subscrição de calendário
    pagamentos/   a conta-corrente vista de quem paga (o cliente)
    pessoas/      ficha, e `pessoas/[id]/pensos` — a conta-corrente do cliente
    cavalos/      ficha, e `cavalos/opcoes` — as listas de raças e pelagens
    paddocks/     o quadro dos campos de largada, hoje
    contratos/
    financeiro/   resumo (page.tsx), por-receber/, despesas/, recebimentos/,
                  contas/ (caixa e bancos), definicoes/ → fornecedores/ e
                  categorias/
  auth/callback/  troca do código de email por sessão
  calendario/     ficheiro iCal por token, sem sessão
  manifest.ts     manifesto da PWA
components/
  ui/             kit de base (botao, campos, superficie, tabela, ferradura)
  ui/folha.tsx    a folha que sobe de baixo e se arrasta, sobre lib/mola.ts
  filtros.tsx     pastilhas e interruptores de filtro, sobre lib/filtros.ts
  pesquisa.tsx    a caixa de pesquisa que escreve ?q= com atraso
  formularios/    campos de cada entidade, partilhados entre criar e editar
  navegacao.tsx   barra lateral, barra de separadores do telemóvel e «Mais»
  pagamento-penso.tsx  receber mensalidades sem sair da conta-corrente
  calendario-mes.tsx   a grelha do mês da agenda
  navegacao-agenda.tsx setas, salto por data e a escolha de vista
  vistas-agenda.tsx    a semana em lista e o quadro do dia
  lista-eventos.tsx    a linha de um evento, partilhada por todas as vistas
  cartao-evento.tsx    o evento em grande, com convocados e avisos
  serie-evento.tsx     a repetição semanal vista de dentro de uma marcação
  responder-convocatoria.tsx  «vou»/«não vou», do lado de quem foi convocado
  formularios/escolher-convocados.tsx  quem fica convocado, ao marcar
  convite-acesso.tsx   estado de acesso de uma pessoa, e o convite
  accoes-ficha.tsx     desactivar/terminar e apagar, no topo de uma ficha
  ferracao-cavalo.tsx  quando foi ferrado, e quando volta a ser
  quadro-paddocks.tsx  os oito campos de largada, e quem está em cada um
  reaccoes.tsx         reagir a uma mensagem do chat, com resposta imediata
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
  cavalos-por-aprovar.tsx  as fichas que os clientes inscreveram
  decidir-cavalo.tsx   aprovar ou recusar, na ficha do cavalo
  ausencias-anunciadas.tsx  quem já disse que não vai
  ferracao-a-precisar.tsx  os cavalos que esperam o ferrador
  abertura.tsx       a marca enquanto a aplicação arranca
  escolha-metodo.tsx   método de pagamento em pastilhas, partilhado
  usar-formulario.ts   o gancho que limpa um formulário depois de gravar
  onde-esta-a-correr.tsx  o diagnóstico de velocidade, em /conta
  (publico)/auth/ligar/  lê a sessão do fragmento do link de email
  notificacao.tsx    confirmação depois de gravar e redireccionar
lib/
  supabase/       clientes de browser, servidor e middleware
  accoes/         Server Actions, uma por área
  tipos-bd.ts     tipos da base de dados (escritos à mão — ver abaixo)
  formatos.ts     euros, datas, horas, meses, leitura de valores escritos por pessoas
  fatura-qr.ts    leitura do QR das faturas portuguesas (+ testes)
  vcard.ts        leitura de cartões de contacto .vcf (+ testes)
  filtros.ts      o endereço de um filtro, sem apagar os outros (+ testes)
  mola.ts         molas, projecção de inércia e elástico de bordo (+ testes)
  reaccoes.ts     os emojis do chat, e o que o toque muda no ecrã (+ testes)
  ical.ts         geração do ficheiro de calendário (+ testes)
  rotulos.ts      rótulos PT-PT dos enumerados
  opcoes-cavalo.ts  o que o selector de raças partilha com a Server Action
  origem.ts       o endereço público que vai nos links de email (+ testes)
  diagnostico.ts  região, distância aos dados e à autenticação, arranque a frio
  contas.ts       a conta onde o dinheiro entra, criada sozinha se faltar
  notificacoes/enviar.ts  o envio de avisos — o único sítio com a chave de serviço
  supabase/sem-sessao.ts  cliente sem cookies, para falar em nome de outra pessoa
supabase/
  migrations/     esquema versionado
  seed.sql        dados de demonstração (só desenvolvimento)
  tests/          arremedo do Supabase + testes de RLS (01 geral, 02 eventos,
                  03 ferração, 04 contratos, 05 cavalos, 06 encargos,
                  07 notas, 08 subscrições, 09 pagamentos declarados,
                  10 confirmação de presença, 11 quem paga o ferrador,
                  12 paddocks, 13 aprovação de cavalos, 14 acesso e perfis,
                  15 conversa de equipa, 16 reacções no chat,
                  17 o tratador só consulta)
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
  Supabase está em West EU (Ireland), `eu-west-1`. Confirmado em produção pelo
  cartão de `/conta`: servidor em Dublin, ida e volta aos dados em 0–1 ms.
  **As duas têm de corresponder**: por omissão a Vercel corre em Washington, e com o Supabase na
  Europa cada ida e volta custava ~180 ms. Se mudares a região do Supabase, muda
  aqui também — Frankfurt `fra1`, Londres `lhr1`, Paris `cdg1`, Estocolmo `arn1`.
- `app/(painel)/loading.tsx` é o que o Next mostra enquanto gera a página, e
  também o que pré-carrega ao passar por cima das ligações. Sem ele o clique
  parece não ter sido registado.
- **O que sobra é o arranque a frio, e está medido.** Com o servidor e a base
  na mesma região, os dados a 0 ms e a sessão verificada localmente, o que
  resta a explicar «lenta a abrir» é a função ser criada de novo quando
  ninguém entra na aplicação há uns minutos — numa casa com ~80 pessoas a
  entrar aos bocados, é quase sempre. `vercel.json` traz `"fluid": true`
  explícito por causa disto: é o que faz a Vercel reaproveitar instâncias em
  vez de criar uma por pedido. Vem ligado de origem nos projectos novos, mas
  escrito à mão não deixa dúvida nem depende de um valor por omissão mudar.
- **`/aquecer` existe para manter a função acordada** — `app/aquecer/route.ts`.
  Os registos da Vercel confirmaram o diagnóstico sem margem: **50 minutos a
  meio da manhã sem um único pedido**. Numa casa de ~80 pessoas que entram aos
  bocados, quase toda a gente apanha sempre um arranque a frio.
  - **Não basta devolver `200`.** Uma rota que não fala com nada deixava fria
    exactamente a parte que custa: carregar o cliente do Supabase e abrir a
    ligação. Daí a contagem com `head: true`, que é a mais barata que há.
  - **É público** (está nos `CAMINHOS_PUBLICOS`) e não tem nada a proteger:
    corre com a chave anónima, a RLS devolve-lhe zero, não escreve nada.
  - **No plano Hobby o cron da Vercel corre uma vez por dia**, o que não serve
    para isto. Quem bate de cinco em cinco minutos é um serviço externo
    gratuito (cron-job.org, UptimeRobot) apontado a
    `https://quinta-figueira.vercel.app/aquecer`. Com o plano Pro passa a
    haver um `crons` no `vercel.json` e o externo deixa de ser preciso.
  - Isto **não torna a aplicação mais rápida**: mantém-na acordada, que é
    outra coisa — e é a que faltava.
- **`/conta` mostra à gestão porque é que a aplicação parece lenta** —
  `<OndeEstaACorrer>`, sobre `lib/diagnostico.ts`. «Está lenta» não se resolve
  a adivinhar, e os logs da Vercel no plano Hobby só duram uma hora: quando se
  vai ver, já não há nada lá. O cartão mede **três coisas separadas, porque
  são causas diferentes**:
  - **A ida e volta aos dados** (Postgres), com uma contagem sobre `contas` e
    `head: true` — não devolve linhas, mede a viagem e não o trabalho da base.
  - **A ida e volta à autenticação**, que é **outro serviço**. Medir só o
    Postgres e julgar que se mediu o caminho da sessão foi um engano real
    desta investigação: os dados davam 1 ms e a sessão não passa por lá.
    **Cada medição cria um cliente novo**, porque o cliente do Supabase guarda
    o utilizador em memória depois da primeira pergunta — reutilizá-lo media a
    memória e dava 0 ms, que foi o segundo engano.
  - **Se as chaves assimétricas estão ligadas**, por `lerAssinatura()`: o
    algoritmo está escrito no cabeçalho do token (`HS*` = segredo partilhado,
    `RS*`/`ES*` = assimétrica). Isto substituiu uma comparação de tempos que,
    com tudo a 0 ms, chegou a avisar que a sessão ia à rede logo a seguir a
    dizer que demorava 0 ms. **Um facto lido não se discute; dois tempos
    parecidos discutem-se sempre.**
  - **O arranque a frio**, por um contador no topo de `lib/diagnostico.ts` —
    criado uma vez por **instância** da função, não por pedido. Ver sempre
    «arrancou agora» ao abrir a aplicação é a resposta a «porque é que a
    primeira página demora tanto». É um indicador, não um cronómetro.

  Cada medição corre três vezes e fica a melhor: a pior de três diz mais sobre
  o instante do que sobre a distância.
  `REGIAO_ESPERADA` está repetida em `lib/diagnostico.ts` de propósito:
  `vercel.json` não entra no pacote da função, e lê-lo com `fs` em produção
  daria errado — a mesma armadilha dos ficheiros de `public/`. **Se mudares a
  região num, muda no outro.**

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
- **Um filtro copia os parâmetros do endereço, nunca os reconstrói.** Cada
  listagem escrevia os seus à mão (`/cavalos?regime=penso`), e o efeito era
  que escolher um regime **apagava a pesquisa** e ligar «incluir inactivos»
  apagava o regime: quem procurava «Lusitano» e depois filtrava via a
  pesquisa desaparecer sem perceber porquê. `<FiltroPastilhas>` e
  `<AlternarFiltro>` em `components/filtros.tsx` são a saída única, sobre
  `enderecoComFiltro()` em `lib/filtros.ts` — que vive fora do componente
  **para poder ser testado**, e é testado porque foi isto que esteve errado.
  São `<Link>` e não botões: funcionam sem JavaScript, abrem em separador
  novo e o Next pré-carrega-os.
- **Procurar nas despesas e nos recebimentos sai do mês escolhido.** Quem
  escreve «veterinário» não sabe de que mês era a factura — se soubesse,
  mudava o mês e olhava. Presa ao mês, a pesquisa respondia «nada
  encontrado» sobre uma despesa que existe, que é a pior resposta que uma
  pesquisa pode dar. É o mesmo raciocínio que tirou `/financeiro/por-receber`
  do mês a mês. O selector de mês fica, mas a página diz que não está a
  mandar, e **os rótulos dos indicadores mudam** («Total encontrado» em vez
  de «Total do mês»): um número certo com um nome errado é pior do que não
  ter número.
  - O nome do fornecedor e o da pessoa vivem noutra tabela. Vão-se buscar os
    ids que batem certo e juntam-se à condição com `in.(…)`, em vez de um
    `!inner` — que filtrava fora as despesas **sem** fornecedor, e essas são
    muitas. `in.()` com a lista vazia é sintaxe inválida, por isso a condição
    só entra quando há ids.
  - Nos **contratos** a pesquisa é feita em memória: o que se procura é o
    nome do cavalo ou do cliente, são ~60 linhas já carregadas, e filtrá-los
    no PostgREST obrigava ao mesmo `!inner`. A comparação tira os acentos,
    para «fidalgo» encontrar «Fidalgo».
- **Onde não há pesquisa, é por a lista ser curta**: equipas (duas),
  categorias de despesa (uma dúzia), paddocks (um quadro de oito) e
  `/financeiro/por-receber` (uma linha por cliente com dívida). Acrescentar
  uma caixa de pesquisa a uma lista que cabe no ecrã é ruído.
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
- **Nada de `<form>` nem de `<div>` dentro de um `<p>`, e isto já custou uma
  página inteira.** A linha do autor de uma mensagem do chat era um `<p>` com
  o botão «apagar» lá dentro — que é um `<form>`. Pelas regras de parsing do
  HTML **um `<form>` fecha um `<p>` aberto**, por isso o browser construía
  `<p>…</p><form>…</form>` onde o React tinha mandado `<p>…<form/></p>`.
  Enquanto o `<form>` era o **último** filho, o React tolerava a diferença e
  ninguém dava por nada. No dia em que se pôs alguma coisa a seguir — as
  reacções — a diferença passou a ser estrutural: a hidratação aborta e atira.
  **O erro é do lado do browser, por isso não deixa um único registo no
  servidor** — a ficha da equipa dava «Alguma coisa correu mal» e os registos
  da Vercel estavam vazios, o que manda procurar no sítio errado. Uma linha
  que leve um botão de acção não é um parágrafo.
- **O ecrã de erro mostra o erro, não só uma referência** (`app/error.tsx`).
  Mostrava só o `digest`, que serve para procurar nos registos do servidor —
  e esses duram uma hora no plano Hobby e **não existem de todo** quando o
  erro é do browser. Em produção o Next apaga a mensagem dos erros do
  servidor, por isso o que lá aparecer já diz de que lado foi: mensagem
  verdadeira é do browser; a frase genérica do Next é do servidor.
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
  apagar e recusa — apagar é só para a ficha escrita por engano. A largada no
  paddock não entra na conta: `paddock_ocupacao` é `cascade`, mas é o quadro
  de hoje e não histórico, e o cavalo que sai do centro sai do campo.
  `supabase/tests/05_cavalos.sql` prova cada um destes quatro comportamentos.
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

### O painel: o dia, e o que está à espera de uma decisão

**O dinheiro saiu do painel de propósito.** Receitas, despesas, saldos e
pensos por receber viviam na página de entrada **e** em `/financeiro`, que é
onde se vai quando a pergunta é sobre dinheiro. Em duplicado, o painel passava
a ser um relatório mensal — com selector de mês e tudo — em vez de ser o que
se abre de manhã. Quem quer os números abre o Financeiro; a porta de lá é
exactamente a mesma pergunta («quem me deve», «o que gastei») e com mais
detalhe. **Não voltes a pôr dinheiro no painel.**

O que ficou são duas coisas, por esta ordem:

1. **O que alguém de fora pôs à espera de resposta.** São as coisas que um
   cliente faz dentro desta aplicação, e cada uma fica parada até a gestão lhe
   tocar: `<CavalosPorAprovar>`, `<PagamentosPorConfirmar>`,
   `<NotasPorResponder>` e `<AusenciasAnunciadas>`. **Todos desaparecem quando
   estão vazios** — num dia normal não há nenhum, e um cartão vazio todos os
   dias ensina a não olhar para ele.
2. **Os números de cadastro** — cavalos no centro, proprietários, pessoas
   activas, cavalos nos paddocks hoje. Não mudam de um dia para o outro, e é
   isso que os torna úteis: dizem a dimensão do centro, não são uma métrica a
   vigiar. «Cavalos no centro» conta só os aprovados; «Proprietários» sai de
   `pessoa_papeis`, porque é o papel que descreve o que a pessoa é no centro e
   não o facto de ter um cavalo neste momento.

`<FerracaoAPrecisar>` é a excepção à regra do cartão vazio: **aparece sempre**,
mesmo sem nada a precisar. «Está tudo em dia» é informação, e a volta do
ferrador marca-se com dias de antecedência.

O painel da equipa é o mesmo menos as duas coisas que a RLS não lhes deixa ver
ou decidir — os pagamentos declarados e a aprovação de fichas.

### A abertura, e porque é que não é uma espera inventada

`<Abertura>` mostra a marca ao entrar na aplicação, e **custa 0,6 segundos**.
Esteve em 1,6 s: o centro veio dizer que a aplicação parecia lenta a reagir, e
metade dessa queixa era este ecrã. **Se voltar a crescer, é o primeiro sítio
onde ir ver.**
Vale a pena dizer o que ela não faz, para não se acreditar no contrário:
**não tapa o arranque a frio** da função na Vercel. Esse acontece antes,
enquanto o HTML não chega, e aí não há página nenhuma onde pôr a marca. A
abertura soma-se a ele.

Foi uma escolha, e não um efeito secundário: a aplicação passa a começar com
a marca em vez de começar a meio. O que a impede de ser um imposto é o
desenho à volta, e é por isso que estas três coisas não se mexem sem pensar:

- **Uma vez por sessão do browser**, não a cada clique: um `script` inline
  corre antes de o elemento ser pintado e tira-o do caminho se já não for a
  primeira abertura. As navegações dentro da aplicação nem passam pelo layout.
- **Quem a tira do ecrã é uma animação de CSS que acaba em
  `visibility: hidden`**, e não JavaScript — não há estado de React nem
  temporizador que possa ficar preso a tapar a aplicação. É também por isso
  que não é um componente de cliente: não há nada para hidratar, e uma
  diferença entre o servidor e o browser dava um salto logo no primeiro
  instante.
- **Com «menos movimento» ligado, desaparece de imediato.** Quem o faz é a
  regra global de `prefers-reduced-motion` no fim de `app/globals.css`, que
  corta a duração de todas as animações da aplicação. Um enfeite não se impõe
  a quem o desligou.
- A duração está em `--abertura-duracao`, em `app/globals.css`, e é o único
  sítio onde se mexe nela.

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
não levam filtro por pessoa em lado nenhum. O cliente escreve em cinco sítios,
e só nesses: as **notas do cavalo**, o **«Já paguei»**, a **resposta à
convocatória** («vou»/«não vou», que não é presença), a **ferração dos cavalos
em que é ele que paga ao ferrador** — que é uma afirmação à
espera de confirmação, não um lançamento (ver a decisão em cima) — e a
**inscrição de um cavalo dele**, que fica por aprovar. O que era preciso limar não era a
segurança, era a linguagem — o cliente estava a ver as páginas da gestão com os
dados dele lá dentro.

**Quem paga não recebe.** Do lado do cliente a palavra é **pagamento**;
«recebimento» é a palavra da gestão e fica do lado dela. `/pagamentos` é a
conta-corrente vista de quem paga — por pagar, já pago, e cada mês com os
pagamentos por baixo — e ocupa na barra de baixo o lugar que «Pessoas» lhe
deixa livre. `/financeiro/recebimentos` é só da gestão (`exigirGestao`).

O resto do que saiu, e porquê:

- **Paddocks** (onde dantes estavam as boxes) é `e_equipa()` e **Contratos de
  penso** `e_gestao()`: ao cliente eram duas entradas de menu que abriam ecrãs
  quase vazios. O dono vê o paddock do cavalo dele na ficha dele, e recebe o
  aviso quando ele é largado.
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
- **Um alvo de toque tem 44px, e é `pointer-coarse:` que o garante.** É a
  mesma história do `text-base` nos campos: o que serve o rato não serve o
  dedo. `tamanho="pequeno"` era `h-8`, ou seja 32px — e é o tamanho dos botões
  que mais se tocam na cavalariça («Recolher» no quadro dos paddocks, «Já
  paguei», «Aprovar»), muitas vezes com luvas. Em `components/ui/botao.tsx`
  todos os tamanhos sobem ao mínimo nos ecrãs de toque e ficam como estavam no
  computador. **Não ponhas um alvo abaixo de 44px em `pointer-coarse`.**
- **Num ecrã de toque não há `hover`, e sem `active:` um toque não mostra
  nada.** Os botões e as linhas das listagens só tinham estado de rato: quem
  tocava ficava a olhar para um ecrã igual até a página seguinte chegar — e
  com o arranque a frio isso são segundos. É a mesma queixa de «parece que não
  aconteceu nada» que já tinha trazido o `<Notificacao>` e a limpeza dos
  formulários. Numa variante nova de botão, o `active:` não é opcional.
- **A barra de cima leva `safe-area-inset-top`, como a de baixo leva o
  `inset-bottom`.** O `viewport-fit: cover` do layout de raiz manda a página
  passar **por baixo** da barra de estado. No browser não se nota, porque a
  barra do Safari está lá em cima; na aplicação instalada — que é como a
  gestão a manda instalar em `/instalar` — o logótipo ficava meio tapado pelo
  relógio e pelo entalhe. A barra de baixo já estava tratada; a de cima tinha
  ficado para trás.
- **`prefers-reduced-motion` corta as animações em toda a aplicação**, numa
  regra só no fim de `app/globals.css`. Não é preferência estética: para quem
  tem sensibilidade vestibular, uma interface que desliza provoca mal-estar a
  sério. A duração fica em `0.01ms` e não em `0` de propósito — um
  `animationend` que nunca dispara deixa preso quem espera por ele.
- **O painel «Mais» é uma folha que se agarra, e o movimento é uma mola.**
  `components/ui/folha.tsx` sobre `lib/mola.ts`. Aparecia e desaparecia de
  repente, e só saía acertando no «X». As decisões, porque custam a
  reconstituir:
  - **Mola e não `transition`.** Uma transição tem duração fixa e começa
    sempre do mesmo sítio: agarrar o painel a meio obrigava a saltar para o
    fim, e largar o dedo a 2000 px/s dava a mesma animação que largar parado.
    Uma mola sabe de posição **e** de velocidade. Daí nada disto poder ser
    CSS, e daí o `prefers-reduced-motion` ter de ser tratado em JavaScript —
    a regra global de CSS não alcança um `requestAnimationFrame`.
  - **A mola é resolvida analiticamente**, não integrada passo a passo. Num
    telemóvel a engasgar um fotograma vale 100 ms, e é aí que um integrador
    de Euler divergia. `lib/mola.test.ts` prova que um salto de 100 ms dá o
    mesmo que dez de 10 ms.
  - **A posição vive numa `ref` e vai directa ao `style`.** Passar por estado
    de React a 60 fps punha um fotograma entre o dedo e a superfície.
  - **O que decide ao largar é a projecção, não a posição.** Um puxão curto e
    rápido para baixo é «fecha isto» mesmo com a folha quase toda no ecrã —
    `repousoProjectado`.
  - **Ressalto só quando o gesto o trouxe**: ζ=1 por omissão, ζ=0,8 acima de
    600 px/s. O ressalto é a inércia da pessoa, não um enfeite da aplicação.
  - **Arrasta-se pelo cabeçalho, não pelo conteúdo**, e é deliberado: para o
    conteúdo também arrastar era preciso tirar ao browser o deslize nativo da
    lista e reimplementá-lo. A pega existe para dizer onde é que se pega.
  - **Os ouvintes do gesto estão na janela, não no elemento.** Com eles no
    painel, arrastar **para cima** tirava o dedo de cima da folha antes de o
    gesto começar e o elástico do bordo não existia. Capturar o ponteiro no
    `pointerdown` resolvia o movimento mas entregava o `click` ao elemento
    que capturou, e o «X» deixava de responder.
  - **Largar sem chegar a arrastar tem de voltar a largar a mola.** Pousar o
    dedo pára-a; sem este caso, tocar na pega a meio da abertura deixava a
    folha encravada a meio do ecrã para sempre.
  - **Escurecer e desfocar o fundo, em vez de pôr vidro sobre vidro.** As
    duas barras já são translúcidas; uma terceira camada por cima delas dava
    uma sopa. A folha é opaca e o fundo afasta-se.
  - Os quatro comportamentos (seguir o dedo, projecção, elástico,
    interrupção) foram conduzidos no browser com eventos de ponteiro a sério
    — foi assim que apareceram os dois defeitos acima.
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
