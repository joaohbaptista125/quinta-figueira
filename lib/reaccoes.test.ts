import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EMOJIS_COMUNS,
  agruparReaccoes,
  alternarNaLista,
  eEmojiConhecido,
  type ReaccaoAgrupada,
} from './reaccoes.ts'

test('só os emojis da lista são aceites', () => {
  for (const emoji of EMOJIS_COMUNS) assert.ok(eEmojiConhecido(emoji))
  assert.ok(!eEmojiConhecido('🐴'))
  assert.ok(!eEmojiConhecido(''))
  assert.ok(!eEmojiConhecido('ok'))
})

test('reagir pela primeira vez cria a pastilha', () => {
  const depois = alternarNaLista([], '👍', 'Maria')
  assert.deepEqual(depois, [{ emoji: '👍', nomes: ['Maria'], minha: true }])
})

test('reagir outra vez com o mesmo emoji desfaz', () => {
  const antes: ReaccaoAgrupada[] = [
    { emoji: '👍', nomes: ['Maria'], minha: true },
  ]
  assert.deepEqual(alternarNaLista(antes, '👍', 'Maria'), [])
})

test('a última pessoa a retirar leva a pastilha com ela', () => {
  const antes: ReaccaoAgrupada[] = [
    { emoji: '👍', nomes: ['João', 'Maria'], minha: true },
    { emoji: '🎉', nomes: ['Ana'], minha: false },
  ]
  const depois = alternarNaLista(antes, '👍', 'Maria')
  assert.deepEqual(depois, [
    { emoji: '👍', nomes: ['João'], minha: false },
    { emoji: '🎉', nomes: ['Ana'], minha: false },
  ])
})

test('juntar-me a uma reacção que já existe não a duplica', () => {
  const antes: ReaccaoAgrupada[] = [
    { emoji: '❤️', nomes: ['Ana'], minha: false },
  ]
  const depois = alternarNaLista(antes, '❤️', 'Maria')
  assert.equal(depois.length, 1)
  assert.deepEqual(depois[0], {
    emoji: '❤️',
    nomes: ['Ana', 'Maria'],
    minha: true,
  })
})

test('duas pessoas com o mesmo nome: sai uma, fica a outra', () => {
  const antes: ReaccaoAgrupada[] = [
    { emoji: '👍', nomes: ['João Silva', 'João Silva'], minha: true },
  ]
  const depois = alternarNaLista(antes, '👍', 'João Silva')
  assert.deepEqual(depois, [
    { emoji: '👍', nomes: ['João Silva'], minha: false },
  ])
})

test('a fila segue sempre a ordem da lista, e não a de quem reagiu', () => {
  let lista: ReaccaoAgrupada[] = []
  lista = alternarNaLista(lista, '😮', 'Ana')
  lista = alternarNaLista(lista, '👍', 'Ana')
  lista = alternarNaLista(lista, '🎉', 'Ana')
  assert.deepEqual(
    lista.map((r) => r.emoji),
    ['👍', '🎉', '😮'],
  )
})

test('as linhas da base agrupam-se por emoji, e sei quais são as minhas', () => {
  const agrupadas = agruparReaccoes(
    [
      { emoji: '👍', pessoa_id: 'a', nome: 'Ana' },
      { emoji: '🎉', pessoa_id: 'b', nome: 'Bruno' },
      { emoji: '👍', pessoa_id: 'b', nome: 'Bruno' },
    ],
    'b',
  )

  assert.deepEqual(agrupadas, [
    { emoji: '👍', nomes: ['Ana', 'Bruno'], minha: true },
    { emoji: '🎉', nomes: ['Bruno'], minha: true },
  ])
})

test('sem reagir, nenhuma pastilha é minha', () => {
  const agrupadas = agruparReaccoes(
    [{ emoji: '👏', pessoa_id: 'a', nome: 'Ana' }],
    'z',
  )
  assert.deepEqual(agrupadas, [
    { emoji: '👏', nomes: ['Ana'], minha: false },
  ])
})
