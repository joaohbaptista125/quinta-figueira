import 'server-only'

/**
 * Onde é que isto está a correr, e a que distância está a base de dados.
 * =============================================================================
 *
 * Cada navegação é uma renderização no servidor que fala com o Supabase, por
 * isso o que se sente ao clicar é, em boa parte, a distância entre os dois.
 * Isto existe para essa pergunta deixar de se responder por palpite.
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
 * Quanto demora uma ida e volta ao Supabase, medida agora.
 *
 * Uma consulta de contagem sobre uma tabela pequena, que não devolve linhas
 * nenhumas: o que se mede é a viagem, não o trabalho da base. Três medições e
 * fica-se com a **melhor** — a pior de três diz mais sobre o momento do que
 * sobre a distância, e o que interessa saber aqui é o chão.
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
