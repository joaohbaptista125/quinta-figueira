import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  deslocarDias,
  formatarDiaPorExtenso,
  formatarIntervaloDeDias,
  deslocarMeses,
  diasDaSemana,
  gradeDoMes,
  inicioDaSemana,
  mesmoMes,
  primeiroDiaDoMes,
} from './formatos.ts'

test('a semana começa à segunda-feira', () => {
  // 2026-10-10 é um sábado.
  assert.equal(inicioDaSemana('2026-10-10'), '2026-10-05')
  // A própria segunda não se mexe.
  assert.equal(inicioDaSemana('2026-10-05'), '2026-10-05')
  // O domingo pertence à semana que começou na segunda anterior, não à
  // seguinte — é aqui que uma implementação ingénua falha.
  assert.equal(inicioDaSemana('2026-10-11'), '2026-10-05')
})

test('a semana tem sete dias seguidos, de segunda a domingo', () => {
  const dias = diasDaSemana('2026-10-10')
  assert.equal(dias.length, 7)
  assert.equal(dias[0], '2026-10-05')
  assert.equal(dias[6], '2026-10-11')
})

test('a grelha do mês cobre semanas inteiras', () => {
  // Outubro de 2026 começa a uma quinta e acaba a um sábado.
  const grelha = gradeDoMes('2026-10-01')
  assert.equal(grelha[0], '2026-09-28', 'começa na segunda anterior ao dia 1')
  assert.equal(grelha[grelha.length - 1], '2026-11-01', 'acaba no domingo seguinte')
  assert.equal(grelha.length % 7, 0, 'é sempre um número inteiro de semanas')
  assert.ok(grelha.includes('2026-10-31'), 'inclui o último dia do mês')
})

test('um mês que começa à segunda não leva dias a mais à frente', () => {
  // Junho de 2026 começa a uma segunda.
  const grelha = gradeDoMes('2026-06-15')
  assert.equal(grelha[0], '2026-06-01')
})

test('Fevereiro de um ano bissexto cabe em quatro semanas', () => {
  // 2027-02-01 é uma segunda e o mês tem 28 dias: 4 semanas certas.
  const grelha = gradeDoMes('2027-02-01')
  assert.equal(grelha.length, 28)
  assert.equal(grelha[0], '2027-02-01')
  assert.equal(grelha[27], '2027-02-28')
})

test('a grelha não salta nem repete dias', () => {
  const grelha = gradeDoMes('2026-10-01')
  for (let i = 1; i < grelha.length; i += 1) {
    assert.equal(grelha[i], deslocarDias(grelha[i - 1], 1))
  }
})

test('a mudança da hora legal não parte as contas de dias', () => {
  // Em 2026 a hora de Verão acaba em Portugal a 25 de Outubro.
  assert.equal(deslocarDias('2026-10-24', 1), '2026-10-25')
  assert.equal(deslocarDias('2026-10-25', 1), '2026-10-26')
  assert.equal(inicioDaSemana('2026-10-25'), '2026-10-19')
})

test('mesmoMes compara o mês e não o dia', () => {
  assert.ok(mesmoMes('2026-10-01', '2026-10-31'))
  assert.ok(!mesmoMes('2026-10-31', '2026-11-01'))
})

test('deslocar meses não transborda em meses curtos', () => {
  assert.equal(deslocarMeses(primeiroDiaDoMes('2026-01-31'), 1), '2026-02-01')
  assert.equal(deslocarMeses('2026-12-01', 1), '2027-01-01')
  assert.equal(deslocarMeses('2026-01-01', -1), '2025-12-01')
})

test('o intervalo da semana só repete o mês quando é preciso', () => {
  assert.equal(formatarIntervaloDeDias('2026-10-05', '2026-10-11'), '5 – 11 de Outubro')
  assert.equal(
    formatarIntervaloDeDias('2026-09-28', '2026-10-04'),
    '28 de Setembro – 4 de Outubro',
  )
})

test('o dia por extenso leva maiúscula no dia da semana e no mês', () => {
  assert.equal(formatarDiaPorExtenso('2026-10-10'), 'Sábado, 10 de Outubro')
  assert.equal(formatarDiaPorExtenso('2026-10-05'), 'Segunda-feira, 5 de Outubro')
})
