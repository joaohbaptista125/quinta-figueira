/**
 * Leitura de cartões de contacto (vCard).
 *
 * Serve para não haver que copiar à mão o nome, o telefone e o email de quem
 * já está na lista de contactos do telemóvel. No Android o selector de
 * contactos do sistema dá os campos directamente; no iPhone não existe nada
 * disso no browser, e o caminho é «Partilhar contacto → Guardar em Ficheiros»,
 * que produz um `.vcf` — é esse ficheiro que esta função lê.
 *
 * Não é um leitor completo da norma: interessa o nome, um telefone, um email e
 * a morada. Mas tem de aguentar o que os telemóveis produzem de verdade, que
 * inclui as três coisas que partem um leitor ingénuo:
 *
 *   - linhas dobradas (RFC 6350 §3.2), que continuam com um espaço à frente;
 *   - `ENCODING=QUOTED-PRINTABLE`, que o Android e o Outlook usam para
 *     acentos, e que dobra linhas de outra maneira (um `=` no fim);
 *   - vários cartões no mesmo ficheiro, quando se exporta um grupo.
 */

export type ContactoLido = {
  nome: string | null
  telefone: string | null
  email: string | null
  morada: string | null
}

type Propriedade = {
  nome: string
  /** Parâmetros em minúsculas: tanto `type=cell` como o `CELL` solto do 2.1. */
  parametros: string[]
  valor: string
}

/** Lê todos os cartões de um ficheiro. Um ficheiro pode trazer um grupo. */
export function lerVCards(texto: string): ContactoLido[] {
  const contactos: ContactoLido[] = []
  let actual: Propriedade[] | null = null

  for (const linha of linhasLogicas(texto)) {
    const propriedade = partirPropriedade(linha)
    if (!propriedade) continue

    if (propriedade.nome === 'BEGIN' && /vcard/i.test(propriedade.valor)) {
      actual = []
      continue
    }
    if (propriedade.nome === 'END' && /vcard/i.test(propriedade.valor)) {
      if (actual) contactos.push(montarContacto(actual))
      actual = null
      continue
    }
    if (actual) actual.push(propriedade)
  }

  // Um ficheiro truncado, sem END, ainda assim tem o que interessa.
  if (actual && actual.length > 0) contactos.push(montarContacto(actual))

  return contactos.filter(
    (contacto) =>
      contacto.nome || contacto.telefone || contacto.email || contacto.morada,
  )
}

/**
 * Junta as linhas partidas, das duas maneiras que aparecem.
 *
 * A da norma: a continuação começa por espaço ou tabulação. A do
 * quoted-printable: a linha anterior acaba em `=`, e a continuação vem colada
 * sem espaço nenhum. Como em quoted-printable um `=` verdadeiro se escreve
 * `=3D`, um `=` no fim é sempre uma dobra.
 */
export function linhasLogicas(texto: string): string[] {
  const cruas = texto.replace(/\r\n?/g, '\n').split('\n')
  const saida: string[] = []

  for (const crua of cruas) {
    const anterior = saida.length > 0 ? saida[saida.length - 1] : undefined

    if (
      anterior !== undefined &&
      anterior.endsWith('=') &&
      /encoding=quoted-printable/i.test(anterior)
    ) {
      saida[saida.length - 1] = anterior.slice(0, -1) + crua
      continue
    }

    if (anterior !== undefined && /^[ \t]/.test(crua)) {
      saida[saida.length - 1] = anterior + crua.slice(1)
      continue
    }

    saida.push(crua)
  }

  return saida
}

/** `item1.TEL;TYPE=CELL:+351…` → nome, parâmetros e valor já descodificado. */
function partirPropriedade(linha: string): Propriedade | null {
  if (linha.trim() === '') return null

  // Os parâmetros podem trazer aspas com dois-pontos lá dentro.
  let corte = -1
  let dentroDeAspas = false
  for (let i = 0; i < linha.length; i += 1) {
    const caractere = linha[i]
    if (caractere === '"') dentroDeAspas = !dentroDeAspas
    else if (caractere === ':' && !dentroDeAspas) {
      corte = i
      break
    }
  }
  if (corte === -1) return null

  const pedacos = linha.slice(0, corte).split(';')
  // O prefixo de grupo (`item1.TEL`) é da Apple e não diz nada ao leitor.
  const nome = pedacos[0].split('.').pop()!.trim().toUpperCase()
  const parametros = pedacos.slice(1).map((p) => p.trim().toLowerCase())

  let valor = linha.slice(corte + 1)
  if (parametros.some((p) => p.includes('quoted-printable'))) {
    valor = descodificarQuotedPrintable(valor)
  }

  return { nome, parametros, valor }
}

export function descodificarQuotedPrintable(valor: string): string {
  const octetos: number[] = []
  const codificador = new TextEncoder()

  for (let i = 0; i < valor.length; i += 1) {
    if (valor[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(valor.slice(i + 1, i + 3))) {
      octetos.push(Number.parseInt(valor.slice(i + 1, i + 3), 16))
      i += 2
      continue
    }
    // O resto é ASCII; se vier UTF-8 cru — acontece — não o estragamos.
    for (const octeto of codificador.encode(valor[i])) octetos.push(octeto)
  }

  return new TextDecoder('utf-8').decode(new Uint8Array(octetos))
}

/** Parte um valor estruturado nos seus componentes, sem cortar nos `\;`. */
function componentes(valor: string): string[] {
  const partes: string[] = []
  let actual = ''
  for (let i = 0; i < valor.length; i += 1) {
    if (valor[i] === '\\' && i + 1 < valor.length) {
      actual += valor[i] + valor[i + 1]
      i += 1
      continue
    }
    if (valor[i] === ';') {
      partes.push(actual)
      actual = ''
      continue
    }
    actual += valor[i]
  }
  partes.push(actual)
  return partes
}

function desescapar(valor: string): string {
  return valor
    .replace(/\\n/gi, '\n')
    .replace(/\\([,;\\])/g, '$1')
    .trim()
}

function limpar(valor: string | undefined): string | null {
  if (!valor) return null
  const limpo = desescapar(valor).replace(/\s+/g, ' ').trim()
  return limpo === '' ? null : limpo
}

/**
 * Escolhe entre vários telefones ou emails.
 *
 * Quem tem três números quer o telemóvel, não o fixo do emprego. `PREF` é o
 * que a pessoa marcou como principal e ganha a tudo; a seguir vem o telemóvel.
 */
function melhor(
  propriedades: Propriedade[],
  pontuar: (parametros: string[]) => number,
): string | null {
  let melhorValor: string | null = null
  let melhorNota = -Infinity

  for (const propriedade of propriedades) {
    // Um campo vazio não conta, mesmo que venha marcado como preferido.
    const valor = limpar(propriedade.valor)
    if (!valor) continue

    const nota = pontuar(propriedade.parametros)
    if (nota > melhorNota) {
      melhorNota = nota
      melhorValor = valor
    }
  }

  return melhorValor
}

function temParametro(parametros: string[], ...procurados: string[]): boolean {
  return parametros.some((parametro) =>
    procurados.some((procurado) => parametro.includes(procurado)),
  )
}

function montarContacto(propriedades: Propriedade[]): ContactoLido {
  const de = (nome: string) => propriedades.filter((p) => p.nome === nome)

  return {
    nome: lerNome(propriedades),
    telefone: melhor(de('TEL'), (parametros) => {
      let nota = 0
      if (temParametro(parametros, 'pref')) nota += 2
      if (temParametro(parametros, 'cell', 'mobile', 'iphone')) nota += 3
      if (temParametro(parametros, 'fax')) nota -= 5
      return nota
    }),
    email: melhor(de('EMAIL'), (parametros) =>
      temParametro(parametros, 'pref') ? 2 : 0,
    ),
    morada: lerMorada(de('ADR')),
  }
}

function lerNome(propriedades: Propriedade[]): string | null {
  const completo = limpar(propriedades.find((p) => p.nome === 'FN')?.valor)
  if (completo) return completo

  // Sem FN, o N vem partido: apelido;próprio;meio;prefixo;sufixo.
  const estruturado = propriedades.find((p) => p.nome === 'N')
  if (!estruturado) return null

  const [apelido, proprio, meio] = componentes(estruturado.valor)
  const junto = [proprio, meio, apelido]
    .map((parte) => limpar(parte))
    .filter(Boolean)
    .join(' ')

  return junto === '' ? null : junto
}

function lerMorada(propriedades: Propriedade[]): string | null {
  const escolhida =
    propriedades.find((p) => temParametro(p.parametros, 'pref')) ??
    propriedades[0]
  if (!escolhida) return null

  const [, extensao, rua, localidade, regiao, codigo, pais] = componentes(
    escolhida.valor,
  ).map((parte) => limpar(parte))

  const arruamento = [rua, extensao].filter(Boolean).join(', ')
  const terra = [codigo, localidade].filter(Boolean).join(' ')
  const morada = [arruamento, terra, regiao, pais].filter(Boolean).join(', ')

  return morada === '' ? null : morada
}
