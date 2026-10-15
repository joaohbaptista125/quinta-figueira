/**
 * Formatação portuguesa: euros, datas DD/MM/AAAA, meses por extenso.
 *
 * As datas vindas do Postgres são strings 'AAAA-MM-DD' sem fuso. São tratadas
 * como texto de propósito: converter para Date faria a data saltar um dia
 * conforme o fuso do browser.
 */

const FUSO = 'Europe/Lisbon'

const moeda = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
})

const numero = new Intl.NumberFormat('pt-PT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const mesPorExtenso = new Intl.DateTimeFormat('pt-PT', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** 1234.5 → "1234,50 €" */
export function formatarEuros(valor: number | string | null | undefined) {
  const n = typeof valor === 'string' ? Number(valor) : valor
  if (n == null || Number.isNaN(n)) return '—'
  return moeda.format(n)
}

/** 1234.5 → "1234,50" (sem símbolo, para colunas alinhadas à direita) */
export function formatarNumero(valor: number | string | null | undefined) {
  const n = typeof valor === 'string' ? Number(valor) : valor
  if (n == null || Number.isNaN(n)) return '—'
  return numero.format(n)
}

/** '2026-09-08' → '08/09/2026' */
export function formatarData(iso: string | null | undefined) {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  if (!ano || !mes || !dia) return '—'
  return `${dia}/${mes}/${ano}`
}

/** '2026-09-08T14:03:00Z' → '08/09/2026 15:03' (hora de Lisboa) */
export function formatarDataHora(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: FUSO,
  }).format(new Date(iso))
}

/** '2026-09-01' → 'setembro de 2026' */
export function formatarMes(iso: string | null | undefined) {
  if (!iso) return '—'
  return mesPorExtenso.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`))
}

/** '2026-09-01' → 'Setembro de 2026' */
export function formatarMesCapitalizado(iso: string | null | undefined) {
  const texto = formatarMes(iso)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Data de hoje em Lisboa, no formato 'AAAA-MM-DD'. */
export function hoje() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date())
}

/** Primeiro dia do mês de uma data ISO (ou de hoje). */
export function primeiroDiaDoMes(iso?: string) {
  const base = (iso ?? hoje()).slice(0, 10)
  return `${base.slice(0, 7)}-01`
}

/** Desloca um período mensal 'AAAA-MM-01' em n meses. */
export function deslocarMeses(periodo: string, n: number) {
  const [ano, mes] = periodo.slice(0, 7).split('-').map(Number)
  const total = ano * 12 + (mes - 1) + n
  const novoAno = Math.floor(total / 12)
  const novoMes = (total % 12) + 1
  return `${novoAno}-${String(novoMes).padStart(2, '0')}-01`
}

/**
 * Lê um valor monetário escrito por uma pessoa: aceita "1234,56", "1.234,56"
 * e "1234.56". Devolve null se não for um número válido.
 */
export function lerValorMonetario(texto: string | number | null | undefined) {
  if (texto == null || texto === '') return null
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null

  let limpo = texto.trim().replace(/\s|€/g, '')
  const temVirgula = limpo.includes(',')
  const temPonto = limpo.includes('.')

  if (temVirgula && temPonto) {
    // "1.234,56" — o ponto é separador de milhares.
    limpo = limpo.replace(/\./g, '').replace(',', '.')
  } else if (temVirgula) {
    limpo = limpo.replace(',', '.')
  }

  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

/** '18:00:00' → '18:00' */
export function formatarHora(hora: string | null | undefined) {
  if (!hora) return ''
  return hora.slice(0, 5)
}

/** '18:00:00' + '19:30:00' → '18:00 – 19:30'; sem fim, só o início. */
export function formatarIntervalo(
  inicio: string | null | undefined,
  fim: string | null | undefined,
) {
  const a = formatarHora(inicio)
  const b = formatarHora(fim)
  if (!a) return ''
  return b ? `${a} – ${b}` : a
}

/**
 * '2026-09-10' → 'Quinta-feira, 10 de Setembro'
 *
 * O Intl devolve tudo em minúsculas; aqui os meses escrevem-se com maiúscula,
 * como no resto da aplicação.
 */
export function formatarDiaPorExtenso(iso: string) {
  const texto = new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`))

  return texto
    .replace(/^./, (letra) => letra.toUpperCase())
    .replace(/ de (.)/, (_, letra: string) => ` de ${letra.toUpperCase()}`)
}

/** '2026-09-10' → 'Qui, 10/09' — para colunas estreitas. */
export function formatarDiaCurto(iso: string) {
  const dia = new Intl.DateTimeFormat('pt-PT', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`))
  const [, mes, diaDoMes] = iso.slice(0, 10).split('-')
  const abreviatura = dia.replace('.', '').slice(0, 3)
  return `${abreviatura.charAt(0).toUpperCase()}${abreviatura.slice(1)}, ${diaDoMes}/${mes}`
}

/** Desloca uma data 'AAAA-MM-DD' em n dias. */
export function deslocarDias(iso: string, n: number) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Dias de `de` até `ate`, as duas em 'AAAA-MM-DD'. Negativo se `ate` já passou.
 *
 * Em UTC e sobre o texto, como todo o resto deste ficheiro: datas do Postgres
 * não passam por `new Date()` local, senão o fuso fá-las saltar um dia.
 */
export function diasAte(de: string, ate: string) {
  const inicio = Date.parse(`${de.slice(0, 10)}T00:00:00Z`)
  const fim = Date.parse(`${ate.slice(0, 10)}T00:00:00Z`)
  return Math.round((fim - inicio) / 86400000)
}

/** Idade em anos a partir da data de nascimento. */
export function idadeEmAnos(dataNascimento: string | null | undefined) {
  if (!dataNascimento) return null
  const [ano, mes, dia] = dataNascimento.slice(0, 10).split('-').map(Number)
  const [anoHoje, mesHoje, diaHoje] = hoje().split('-').map(Number)
  let idade = anoHoje - ano
  if (mesHoje < mes || (mesHoje === mes && diaHoje < dia)) idade -= 1
  return idade >= 0 ? idade : null
}

// --- Semanas e grelhas de mês -----------------------------------------------
// A semana começa à segunda-feira, como em Portugal. Tudo em UTC e sobre texto
// 'AAAA-MM-DD': datas do Postgres não passam por new Date() local, senão o
// fuso do browser fá-las saltar um dia.

/** Segunda-feira da semana a que o dia pertence. */
export function inicioDaSemana(iso: string) {
  const data = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  // getUTCDay() dá 0 ao domingo; isto roda para 0 = segunda.
  const posicao = (data.getUTCDay() + 6) % 7
  data.setUTCDate(data.getUTCDate() - posicao)
  return data.toISOString().slice(0, 10)
}

/** Os sete dias da semana a que o dia pertence, de segunda a domingo. */
export function diasDaSemana(iso: string) {
  const inicio = inicioDaSemana(iso)
  return Array.from({ length: 7 }, (_, i) => deslocarDias(inicio, i))
}

/**
 * Os dias da grelha de um mês: semanas inteiras, da segunda antes do dia 1 ao
 * domingo depois do último dia. São 35 ou 42 dias, conforme o mês.
 */
export function gradeDoMes(iso: string) {
  const primeiro = primeiroDiaDoMes(iso)
  const ultimo = deslocarDias(deslocarMeses(primeiro, 1), -1)
  const fim = deslocarDias(inicioDaSemana(ultimo), 6)

  const dias: string[] = []
  for (let dia = inicioDaSemana(primeiro); dia <= fim; dia = deslocarDias(dia, 1)) {
    dias.push(dia)
  }
  return dias
}

/** '2026-10-10' e '2026-10-31' são o mesmo mês; '2026-11-01' não. */
export function mesmoMes(a: string, b: string) {
  return a.slice(0, 7) === b.slice(0, 7)
}

/**
 * '2026-10-05' + '2026-10-11' → '5 – 11 de Outubro'.
 * Com meses diferentes escreve os dois: '28 de Setembro – 4 de Outubro'.
 */
export function formatarIntervaloDeDias(inicio: string, fim: string) {
  const nomeDoMes = (iso: string) =>
    new Intl.DateTimeFormat('pt-PT', { month: 'long', timeZone: 'UTC' })
      .format(new Date(`${iso.slice(0, 10)}T00:00:00Z`))
      .replace(/^./, (letra) => letra.toUpperCase())
  const numeroDoDia = (iso: string) => String(Number(iso.slice(8, 10)))

  if (inicio.slice(0, 7) === fim.slice(0, 7)) {
    return `${numeroDoDia(inicio)} – ${numeroDoDia(fim)} de ${nomeDoMes(inicio)}`
  }
  return `${numeroDoDia(inicio)} de ${nomeDoMes(inicio)} – ${numeroDoDia(fim)} de ${nomeDoMes(fim)}`
}

/** Nomes curtos dos dias da semana, para o cabeçalho da grelha. */
export const DIAS_DA_SEMANA_CURTOS = [
  'Seg',
  'Ter',
  'Qua',
  'Qui',
  'Sex',
  'Sáb',
  'Dom',
] as const
