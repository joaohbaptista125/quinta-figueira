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

**Nunca alteres o esquema pelo painel do Supabase.** Cria uma migração nova e
actualiza `lib/tipos-bd.ts` na mesma alteração.

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

### Vistas

Todas com `security_invoker = on`, para a RLS aplicada ser a de quem consulta.
Uma vista sem isto seria um buraco na RLS — se criares outra, não te esqueças.

- `v_saldos_contas` — saldo inicial + recebimentos − despesas **pagas**
- `v_resumo_mensal` — receitas vs. despesas por mês
- `v_despesas_por_categoria` — despesa por categoria e mês
- `v_pensos_por_receber` — mensalidades com valor pago e valor em falta

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

---

## 5. Organização do código

```
app/
  (publico)/      entrar, recuperar-password, definir-password, primeiro-acesso
  (painel)/       aplicação autenticada — layout com navegação e sessão
    page.tsx      dashboard, com uma variante por perfil
    pessoas/  cavalos/  boxes/  contratos/
    financeiro/   despesas/ recebimentos/ pensos/ contas/ fornecedores/ categorias/
  auth/callback/  troca do código de email por sessão
  manifest.ts     manifesto da PWA
components/
  ui/             kit de base (botao, campos, superficie, tabela)
  formularios/    campos de cada entidade, partilhados entre criar e editar
lib/
  supabase/       clientes de browser, servidor e middleware
  accoes/         Server Actions, uma por área
  tipos-bd.ts     tipos da base de dados (escritos à mão — ver abaixo)
  formatos.ts     euros, datas, meses, leitura de valores escritos por pessoas
  rotulos.ts      rótulos PT-PT dos enumerados
supabase/
  migrations/     esquema versionado
  seed.sql        dados de demonstração (só desenvolvimento)
  tests/          arremedo do Supabase + testes de RLS
scripts/
  validar-esquema.sh   aplica migrações e corre os testes
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
- `vercel.json` fixa a região das funções em `fra1`. **Tem de corresponder à
  região do projecto Supabase**: por omissão a Vercel corre em Washington, e com
  o Supabase na Europa cada ida e volta custava ~180 ms. Se mudares o Supabase
  de região, muda aqui também (Londres `lhr1`, Irlanda `dub1`, Paris `cdg1`).
- `app/(painel)/loading.tsx` é o que o Next mostra enquanto gera a página, e
  também o que pré-carrega ao passar por cima das ligações. Sem ele o clique
  parece não ter sido registado.

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
./scripts/validar-esquema.sh   # migrações + seed + testes de RLS
```

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

O service worker faz **rede primeiro** nas navegações, com cache e
`public/offline.html` como recurso final; ficheiros com hash em `/_next/static/`
são servidos da cache. **Não guarda escritas em fila**: um lançamento feito
offline seria uma promessa impossível de cumprir sem conflitos. Em vez disso
`components/indicador-ligacao.tsx` avisa quando não há rede.

Ícones: `node scripts/gerar-icones.mjs`.

---

## 8. Faseamento

Implementadas: **Fase 1** (cadastro) e **Fase 2** (financeiro e dashboard).

Por implementar — há espaço deixado no modelo, mas as tabelas ainda não existem:

- **Fase 3 — Aulas.** Planeamento por aluno, calendário, presenças, ligação
  aluno ↔ cavalo ↔ instrutor, e cada aula ligada ao respectivo recebimento.
  Ganchos: `recebimentos.tipo = 'aulas'` já existe; a futura tabela `aulas` deve
  apontar para `recebimentos.id`.
- **Fase 4 — Conta-cliente.** Login do aluno (já funciona), ver as suas aulas e
  saldo, marcar treinos de Horseball. Ganchos: perfil `cliente` com RLS já
  activa; `pessoa_papeis.jogador_horseball` já existe; a conta-corrente assenta
  em `mensalidades_penso`.
- **Fase 5 — Stocks e saúde.** Ração e palha com alertas, vacinas, ferrador,
  veterinário, relatórios.

Não comeces uma destas fases sem pedido explícito.

---

## 9. Importação de histórico

O cliente não tem acesso ao sistema que usa hoje. A entrada inicial é manual e os
formulários estão feitos para isso. Uma importação pode vir depois — não
condiciones decisões por causa dela.
