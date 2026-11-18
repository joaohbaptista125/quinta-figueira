import { test } from 'node:test'
import assert from 'node:assert/strict'
import { textoDoDetalhe, traduzirErro } from './resultado.ts'

test('um detalhe que é texto passa tal e qual', () => {
  assert.equal(textoDoDetalhe('Key (nif)=(123) already exists.'), 'Key (nif)=(123) already exists.')
})

test('vazio, nulo e indefinido não ocupam espaço no ecrã', () => {
  assert.equal(textoDoDetalhe(null), null)
  assert.equal(textoDoDetalhe(undefined), null)
  assert.equal(textoDoDetalhe('   '), null)
})

/*
 * Era isto que partia a página: o PGRST201 manda uma lista de objectos, e o
 * React recusa-se a desenhar um objecto. O ecrã que existia para explicar a
 * falha era ele próprio a segunda falha.
 */
test('o detalhe de um embed ambíguo é uma lista de objectos, e vira texto', () => {
  const detalhe = [
    {
      cardinality: 'many-to-one',
      embedding: 'avisos with pessoas',
      relationship: 'avisos_autor_id_fkey using avisos(autor_id) and pessoas(id)',
    },
    {
      cardinality: 'many-to-many',
      embedding: 'avisos with pessoas',
      relationship: 'aviso_reaccoes using aviso_reaccoes_aviso_id_fkey and aviso_reaccoes_pessoa_id_fkey',
    },
  ]

  const texto = textoDoDetalhe(detalhe)
  assert.equal(typeof texto, 'string')
  assert.ok(texto!.includes('avisos_autor_id_fkey'))
  assert.ok(texto!.includes('many-to-many'))
})

test('um objecto solto também não rebenta', () => {
  assert.equal(textoDoDetalhe({ a: 1 }), '{"a":1}')
})

test('uma referência circular não rebenta — é o pior caso do JSON.stringify', () => {
  const circular: Record<string, unknown> = {}
  circular.ele = circular
  assert.equal(typeof textoDoDetalhe(circular), 'string')
})

test('traduzirErro aguenta um detalhe que não é texto', () => {
  const mensagem = traduzirErro({
    code: 'PGRST201',
    message: "Could not embed because more than one relationship was found for 'avisos' and 'pessoas'",
    details: [{ cardinality: 'many-to-one' }],
  })
  assert.equal(typeof mensagem, 'string')
  assert.ok(mensagem.length > 0)
})

test('o 23505 continua a reconhecer o NIF pelo detalhe', () => {
  assert.equal(
    traduzirErro({ code: '23505', message: 'duplicate key', details: 'Key (nif)=(1) exists' }),
    'Já existe um registo com este NIF.',
  )
})
