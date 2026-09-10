import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  carimboLocal,
  dobrarLinha,
  escaparTexto,
  gerarIcal,
} from './ical.ts'

test('escapa os caracteres que a norma reserva', () => {
  assert.equal(escaparTexto('a;b,c'), 'a\\;b\\,c')
  assert.equal(escaparTexto('linha1\nlinha2'), 'linha1\\nlinha2')
  // A barra tem de ser escapada primeiro, senão escapa-se a si própria.
  assert.equal(escaparTexto('a\\b'), 'a\\\\b')
  assert.equal(escaparTexto('c:\\x;y'), 'c:\\\\x\\;y')
})

test('converte data e hora para o formato do calendário', () => {
  assert.equal(carimboLocal('2026-09-10', '18:00:00'), '20260910T180000')
  assert.equal(carimboLocal('2026-12-31', '09:30'), '20261231T0930')
})

test('não dobra linhas curtas', () => {
  assert.equal(dobrarLinha('SUMMARY:Aula'), 'SUMMARY:Aula')
})

test('dobra aos 75 octetos, com um espaço na continuação', () => {
  const dobrada = dobrarLinha('DESCRIPTION:' + 'a'.repeat(200))
  const linhas = dobrada.split('\r\n')
  assert.ok(linhas.length > 1)
  assert.ok(new TextEncoder().encode(linhas[0]).length <= 75)
  for (const seguinte of linhas.slice(1)) {
    assert.equal(seguinte[0], ' ', 'continuação começa por espaço')
    assert.ok(new TextEncoder().encode(seguinte).length <= 75)
  }
  // Desdobrar devolve o original.
  assert.equal(dobrada.replace(/\r\n /g, ''), 'DESCRIPTION:' + 'a'.repeat(200))
})

test('conta octetos e não caracteres ao dobrar', () => {
  // 60 «ç» são 120 octetos: tem de dobrar, apesar de serem 60 caracteres.
  const dobrada = dobrarLinha('SUMMARY:' + 'ç'.repeat(60))
  const linhas = dobrada.split('\r\n')
  assert.ok(linhas.length > 1, 'dobrou')
  for (const linha of linhas) {
    assert.ok(
      new TextEncoder().encode(linha).length <= 75,
      `linha com ${new TextEncoder().encode(linha).length} octetos`,
    )
  }
  // E nenhum caractere ficou partido a meio.
  assert.equal(dobrada.replace(/\r\n /g, ''), 'SUMMARY:' + 'ç'.repeat(60))
})

const BASE = {
  nome: 'Quinta da Figueira',
  dominio: 'quintadafigueira.pt',
}

test('gera um calendário completo', () => {
  const ical = gerarIcal({
    ...BASE,
    eventos: [
      {
        uid: 'evento-1',
        inicio: { data: '2026-09-10', hora: '18:00:00' },
        fim: { data: '2026-09-10', hora: '19:00:00' },
        resumo: 'Aula de Iniciação',
        local: 'Picadeiro coberto',
        descricao: 'Cavalo: Bolota',
        actualizadoEm: '2026-09-09T10:00:00.000Z',
      },
    ],
  })

  assert.ok(ical.startsWith('BEGIN:VCALENDAR\r\n'))
  assert.ok(ical.endsWith('END:VCALENDAR\r\n'))
  assert.ok(ical.includes('TZID:Europe/Lisbon'))
  assert.ok(ical.includes('DTSTART;TZID=Europe/Lisbon:20260910T180000'))
  assert.ok(ical.includes('DTEND;TZID=Europe/Lisbon:20260910T190000'))
  assert.ok(ical.includes('UID:evento-1@quintadafigueira.pt'))
  assert.ok(ical.includes('STATUS:CONFIRMED'))
  assert.ok(ical.includes('LOCATION:Picadeiro coberto'))
  // Toda a linha termina em CRLF, como manda a norma.
  assert.equal(ical.split('\n').length - 1, ical.split('\r\n').length - 1)
})

test('marca os cancelados para o telemóvel os apagar', () => {
  const ical = gerarIcal({
    ...BASE,
    eventos: [
      {
        uid: 'evento-2',
        inicio: { data: '2026-09-10', hora: '18:00:00' },
        fim: { data: '2026-09-10', hora: '19:00:00' },
        resumo: 'Treino',
        cancelado: true,
        actualizadoEm: '2026-09-09T10:00:00.000Z',
      },
    ],
  })
  assert.ok(ical.includes('STATUS:CANCELLED'))
})

test('a sequência sobe quando o evento é alterado', () => {
  const evento = {
    uid: 'evento-3',
    inicio: { data: '2026-09-10', hora: '18:00:00' },
    fim: { data: '2026-09-10', hora: '19:00:00' },
    resumo: 'Aula',
    actualizadoEm: '2026-09-09T10:00:00.000Z',
  }
  const antes = gerarIcal({ ...BASE, eventos: [evento] })
  const depois = gerarIcal({
    ...BASE,
    eventos: [{ ...evento, actualizadoEm: '2026-09-09T11:00:00.000Z' }],
  })
  const sequencia = (t: string) => Number(t.match(/SEQUENCE:(\d+)/)![1])
  assert.ok(sequencia(depois) > sequencia(antes))
})

test('um calendário vazio continua a ser válido', () => {
  const ical = gerarIcal({ ...BASE, eventos: [] })
  assert.ok(ical.includes('BEGIN:VCALENDAR'))
  assert.ok(ical.includes('END:VCALENDAR'))
  assert.ok(!ical.includes('BEGIN:VEVENT'))
})
