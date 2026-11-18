/**
 * Os emojis que o chat oferece.
 *
 * **É uma lista fechada, e aqui isso é a escolha certa** — ao contrário das
 * raças, que têm saída para escrever uma nova. Uma raça que ninguém previu
 * aparece mesmo; um emoji que falte não impede ninguém de dizer o que quer,
 * porque a caixa de texto está logo por baixo. Em troca, uma lista de seis
 * cabe numa linha no telemóvel sem selector nenhum, e as reacções agrupam-se
 * em vez de ficar cada mensagem com o seu emoji próprio.
 *
 * A ordem é a de uso esperado, e é a ordem em que aparecem.
 */
export const EMOJIS_COMUNS = ['👍', '❤️', '😂', '🎉', '👏', '😮'] as const

export type EmojiComum = (typeof EMOJIS_COMUNS)[number]

/**
 * Vive aqui, e não dentro da Server Action, para a lista ser a mesma dos dois
 * lados: o que o ecrã oferece é exactamente o que a acção aceita. A base só
 * trava o comprimento — sem isto, um pedido escrito à mão metia qualquer
 * texto curto na tabela.
 */
export function eEmojiConhecido(valor: string): valor is EmojiComum {
  return (EMOJIS_COMUNS as readonly string[]).includes(valor)
}

/** Uma reacção já dada, com quem a deu e se eu sou um deles. */
export type ReaccaoAgrupada = {
  emoji: string
  nomes: string[]
  /** Se eu reagi com este emoji — é o que faz o botão ser um interruptor. */
  minha: boolean
}

/** A ordem de `EMOJIS_COMUNS`, para a fila de pastilhas não dançar. */
function porOrdemDaLista(reaccoes: ReaccaoAgrupada[]): ReaccaoAgrupada[] {
  const posicao = (emoji: string) => {
    const i = (EMOJIS_COMUNS as readonly string[]).indexOf(emoji)
    return i === -1 ? EMOJIS_COMUNS.length : i
  }
  return [...reaccoes].sort((a, b) => posicao(a.emoji) - posicao(b.emoji))
}

/** Tira **uma** ocorrência, não todas: duas pessoas podem ter o mesmo nome. */
function semUmaOcorrencia(nomes: string[], nome: string): string[] {
  const i = nomes.indexOf(nome)
  return i === -1 ? nomes : [...nomes.slice(0, i), ...nomes.slice(i + 1)]
}

/**
 * O que acontece à lista quando eu carrego num emoji.
 *
 * **Vive fora do componente para poder ser testada**, pela mesma razão que
 * `enderecoComFiltro`: é ela que o ecrã mostra no instante do toque, antes de
 * o servidor responder. Se estiver errada, o que se vê é uma contagem que
 * salta — e com o arranque a frio da Vercel isso fica no ecrã segundos.
 *
 * Agrupar por emoji significa que a última pessoa a retirar leva a pastilha
 * com ela: uma pastilha a zero não é informação nenhuma.
 */
export function alternarNaLista(
  reaccoes: readonly ReaccaoAgrupada[],
  emoji: string,
  meuNome: string,
): ReaccaoAgrupada[] {
  const existente = reaccoes.find((r) => r.emoji === emoji)

  if (!existente) {
    return porOrdemDaLista([
      ...reaccoes,
      { emoji, nomes: [meuNome], minha: true },
    ])
  }

  if (existente.minha) {
    const nomes = semUmaOcorrencia(existente.nomes, meuNome)
    if (nomes.length === 0) return reaccoes.filter((r) => r.emoji !== emoji)
    return reaccoes.map((r) =>
      r.emoji === emoji ? { emoji, nomes, minha: false } : r,
    )
  }

  return reaccoes.map((r) =>
    r.emoji === emoji
      ? { emoji, nomes: [...r.nomes, meuNome], minha: true }
      : r,
  )
}

/**
 * As linhas que vêm da base, agrupadas para o ecrã.
 *
 * A consulta traz uma linha por (mensagem, pessoa, emoji) — é a forma da
 * tabela. O ecrã mostra uma pastilha por emoji.
 */
export function agruparReaccoes(
  linhas: readonly { emoji: string; pessoa_id: string; nome: string }[],
  euId: string,
): ReaccaoAgrupada[] {
  const porEmoji = new Map<string, ReaccaoAgrupada>()

  for (const linha of linhas) {
    const actual = porEmoji.get(linha.emoji) ?? {
      emoji: linha.emoji,
      nomes: [],
      minha: false,
    }
    actual.nomes.push(linha.nome)
    if (linha.pessoa_id === euId) actual.minha = true
    porEmoji.set(linha.emoji, actual)
  }

  return porOrdemDaLista([...porEmoji.values()])
}
