import 'server-only'

/**
 * Porque é que isto parece lento: medido, não adivinhado.
 * =============================================================================
 *
 * Cada navegação é uma renderização no servidor que fala com o Supabase. Há
 * três coisas que a podem atrasar, e são bem diferentes uma da outra:
 *
 * 1. **A distância ao Postgres** — as consultas de dados.
 * 2. **A distância ao servidor de autenticação**, que é outro serviço: é fácil
 *    medir o primeiro e julgar que se mediu o segundo, e foi exactamente esse
 *    o engano que deu origem a este ficheiro. O caminho da sessão passa por lá
 *    e não pelo Postgres.
 * 3. **O arranque a frio** — a função a ser criada do nada porque ninguém
 *    entrou na aplicação nos últimos minutos. Não se mede em milissegundos de
 *    rede: vê-se em quantos pedidos esta instância já serviu.
 */

/**
 * A região onde as funções **devem** correr.
 *
 * Tem de bater certo com `vercel.json` e com a região do projecto Supabase
 * (West EU, Ireland). Está aqui repetido de propósito: `vercel.json` não entra
 * no pacote da função, e lê-lo com `fs` em produção daria errado — é a mesma
 * armadilha dos ficheiros de `public/`.
 */
export const REGIAO_ESPERADA = 'dub1'

/** Os centros de dados da Vercel na Europa, mais os que aparecem por omissão. */
const NOMES: Record<string, string> = {
  arn1: 'Estocolmo',
  cdg1: 'Paris',
  cle1: 'Cleveland',
  dub1: 'Dublin',
  fra1: 'Frankfurt',
  gru1: 'São Paulo',
  hnd1: 'Tóquio',
  iad1: 'Washington',
  lhr1: 'Londres',
  sfo1: 'São Francisco',
  sin1: 'Singapura',
}

export function nomeDaRegiao(codigo: string | null) {
  if (!codigo) return 'desconhecida'
  return NOMES[codigo] ? `${NOMES[codigo]} (${codigo})` : codigo
}

export type EstadoDaRegiao = {
  /** Onde esta renderização está mesmo a correr. Null fora da Vercel. */
  actual: string | null
  esperada: string
  /** 'local' quando se está a correr fora da Vercel, onde isto não se aplica. */
  veredicto: 'igual' | 'diferente' | 'local'
}

export function estadoDaRegiao(): EstadoDaRegiao {
  const actual = process.env.VERCEL_REGION?.trim() || null

  return {
    actual,
    esperada: REGIAO_ESPERADA,
    veredicto: !actual
      ? 'local'
      : actual === REGIAO_ESPERADA
        ? 'igual'
        : 'diferente',
  }
}

/**
 * Há quanto tempo esta instância existe, e quantos pedidos já serviu.
 *
 * Estas duas variáveis vivem no topo do módulo: são criadas **uma vez por
 * instância da função**, não uma vez por pedido. Um pedido que veja
 * `servidos: 1` é o primeiro desta instância — ou seja, pagou o arranque a
 * frio. Ver `servidos: 1` sempre que se abre a aplicação é a resposta à
 * pergunta «porque é que a primeira página demora tanto».
 *
 * É um indicador, não um cronómetro: não diz quantos milissegundos custou o
 * arranque, diz se houve arranque.
 */
const NASCIDA_EM = Date.now()
let pedidosServidos = 0

export function estadoDaInstancia() {
  pedidosServidos += 1
  return {
    servidos: pedidosServidos,
    idadeSegundos: Math.round((Date.now() - NASCIDA_EM) / 1000),
  }
}

/**
 * Como é que o Supabase assina os tokens deste projecto.
 *
 * Isto substitui uma comparação de tempos que não servia: quando tudo dá 0 ms,
 * comparar 0 com 1 não diz nada, e o cartão chegou a avisar que a sessão ia à
 * rede logo a seguir a dizer que demorava 0 ms. O algoritmo está escrito no
 * cabeçalho do próprio token e não precisa de ser adivinhado.
 *
 * `HS*` é o segredo partilhado antigo — `getClaims()` não o pode verificar
 * sozinho e cai para `getUser()`, que é um pedido de rede. `RS*`/`ES*` são as
 * chaves assimétricas, e aí a verificação é local.
 */
export type AssinaturaDoToken = 'simetrica' | 'assimetrica' | null

export function lerAssinatura(token: string | null | undefined): AssinaturaDoToken {
  if (!token) return null
  try {
    const [cabecalho] = token.split('.')
    const { alg } = JSON.parse(
      Buffer.from(cabecalho, 'base64url').toString('utf8'),
    ) as { alg?: string }
    if (!alg) return null
    return alg.startsWith('HS') ? 'simetrica' : 'assimetrica'
  } catch {
    return null
  }
}

/**
 * Quanto demora uma ida e volta ao Supabase, medida agora.
 *
 * Uma consulta de contagem sobre uma tabela pequena, que não devolve linhas
 * nenhumas: o que se mede é a viagem, não o trabalho da base. Três medições e
 * fica-se com a **melhor** — a pior de três diz mais sobre o momento do que
 * sobre a distância, e o que interessa saber aqui é o chão.
 *
 * **Quem chama tem de criar um cliente novo a cada medição quando o que se
 * mede é a autenticação.** O cliente do Supabase guarda o utilizador em
 * memória depois da primeira pergunta, e reutilizá-lo media a memória em vez
 * da rede — foi assim que a autenticação apareceu a 0 ms quando ninguém sabia
 * quanto custava de verdade.
 */
export async function medirIdaEVolta(
  consultar: () => PromiseLike<unknown>,
): Promise<number | null> {
  try {
    // A primeira não conta: é ela que paga a ligação TLS.
    await consultar()

    const tempos: number[] = []
    for (let i = 0; i < 3; i += 1) {
      const inicio = performance.now()
      await consultar()
      tempos.push(performance.now() - inicio)
    }

    return Math.round(Math.min(...tempos))
  } catch {
    return null
  }
}
