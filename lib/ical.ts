/**
 * Geração de ficheiros iCalendar (RFC 5545).
 *
 * Serve a subscrição de calendário: o telemóvel guarda o endereço e volta lá
 * de tempos a tempos, por isso o ficheiro tem de descrever a agenda inteira de
 * cada vez, incluindo os eventos cancelados — é assim que o telemóvel sabe
 * apagá-los de quem já os tinha.
 *
 * As horas vão em hora local com TZID e o ficheiro leva a definição do fuso.
 * A alternativa seria converter tudo para UTC, o que obrigaria a saber de cor
 * quando muda a hora legal; assim é o leitor de calendário que trata disso.
 */

/** Europa/Lisboa: WET no Inverno, WEST no Verão, regra da União Europeia. */
const FUSO_LISBOA = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Lisbon',
  'X-LIC-LOCATION:Europe/Lisbon',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0000',
  'TZOFFSETTO:+0100',
  'TZNAME:WEST',
  'DTSTART:19700329T010000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0000',
  'TZNAME:WET',
  'DTSTART:19701025T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
]

/** Escapa um valor de texto: a barra primeiro, senão escapa-se a si própria. */
export function escaparTexto(valor: string) {
  return valor
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Dobra as linhas aos 75 octetos, como manda a norma.
 *
 * A contagem é em octetos, não em caracteres: um «ç» ocupa dois, e cortar a
 * meio de um deles produz um ficheiro inválido. Daí medir em UTF-8 e nunca
 * partir dentro de um caractere.
 */
export function dobrarLinha(linha: string) {
  const codificador = new TextEncoder()
  if (codificador.encode(linha).length <= 75) return linha

  const partes: string[] = []
  let actual = ''
  let octetos = 0
  // O limite das linhas de continuação é 74, porque levam um espaço à frente.
  let limite = 75

  for (const caractere of linha) {
    const tamanho = codificador.encode(caractere).length
    if (octetos + tamanho > limite) {
      partes.push(actual)
      actual = caractere
      octetos = tamanho
      limite = 74
    } else {
      actual += caractere
      octetos += tamanho
    }
  }
  partes.push(actual)

  return partes.join('\r\n ')
}

/** '2026-09-10' + '18:00:00' → '20260910T180000' */
export function carimboLocal(data: string, hora: string) {
  return `${data.replace(/-/g, '')}T${hora.slice(0, 8).replace(/:/g, '')}`
}

/** Instante em UTC, para o DTSTAMP. */
export function carimboUtc(iso: string) {
  return `${new Date(iso).toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`
}

export type EventoIcal = {
  uid: string
  inicio: { data: string; hora: string }
  fim: { data: string; hora: string }
  resumo: string
  local?: string | null
  descricao?: string | null
  cancelado?: boolean
  /** Muda sempre que o evento é alterado, para o cliente saber que é nova. */
  actualizadoEm: string
}

export function gerarIcal({
  nome,
  dominio,
  eventos,
}: {
  nome: string
  /** Usado no UID, que tem de ser único e estável no mundo. */
  dominio: string
  eventos: EventoIcal[]
}) {
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Quinta da Figueira//Agenda//PT`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escaparTexto(nome)}`,
    'X-WR-TIMEZONE:Europe/Lisbon',
    // Sugestões de frequência de actualização, cada cliente respeita a sua.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...FUSO_LISBOA,
  ]

  for (const evento of eventos) {
    linhas.push(
      'BEGIN:VEVENT',
      `UID:${evento.uid}@${dominio}`,
      `DTSTAMP:${carimboUtc(evento.actualizadoEm)}`,
      `DTSTART;TZID=Europe/Lisbon:${carimboLocal(evento.inicio.data, evento.inicio.hora)}`,
      `DTEND;TZID=Europe/Lisbon:${carimboLocal(evento.fim.data, evento.fim.hora)}`,
      `SUMMARY:${escaparTexto(evento.resumo)}`,
      `STATUS:${evento.cancelado ? 'CANCELLED' : 'CONFIRMED'}`,
      // Sobe a cada alteração; sem isto alguns clientes ignoram a versão nova.
      `SEQUENCE:${Math.floor(new Date(evento.actualizadoEm).getTime() / 1000)}`,
    )
    if (evento.local) linhas.push(`LOCATION:${escaparTexto(evento.local)}`)
    if (evento.descricao) {
      linhas.push(`DESCRIPTION:${escaparTexto(evento.descricao)}`)
    }
    linhas.push('END:VEVENT')
  }

  linhas.push('END:VCALENDAR')

  return linhas.map(dobrarLinha).join('\r\n') + '\r\n'
}
