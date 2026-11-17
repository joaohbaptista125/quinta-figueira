import { test } from 'node:test'
import assert from 'node:assert/strict'
import { enderecoComFiltro } from './filtros.ts'

test('mudar um filtro não apaga a pesquisa — era este o defeito', () => {
  assert.equal(
    enderecoComFiltro('/cavalos', 'q=lusitano', 'regime', 'penso'),
    '/cavalos?q=lusitano&regime=penso',
  )
})

test('nem apaga os outros filtros', () => {
  assert.equal(
    enderecoComFiltro('/cavalos', 'q=lusitano&regime=penso', 'inactivos', '1'),
    '/cavalos?q=lusitano&regime=penso&inactivos=1',
  )
})

test('tirar um filtro deixa os outros onde estavam', () => {
  assert.equal(
    enderecoComFiltro('/cavalos', 'q=lusitano&regime=penso', 'regime', undefined),
    '/cavalos?q=lusitano',
  )
})

test('substitui em vez de acumular', () => {
  assert.equal(
    enderecoComFiltro('/cavalos', 'regime=escola', 'regime', 'centro'),
    '/cavalos?regime=centro',
  )
})

test('sem parâmetro nenhum, o endereço fica limpo e sem «?»', () => {
  assert.equal(enderecoComFiltro('/cavalos', 'regime=penso', 'regime', undefined), '/cavalos')
  assert.equal(enderecoComFiltro('/pessoas', '', 'papel', undefined), '/pessoas')
})

test('um termo com espaços e acentos sobrevive à viagem', () => {
  const endereco = enderecoComFiltro('/pessoas', 'q=Sónia Pais', 'papel', 'aluno')
  // É escapado no endereço...
  assert.ok(endereco.includes('q=S%C3%B3nia+Pais'))
  // ...e volta inteiro do outro lado.
  const lido = new URLSearchParams(endereco.split('?')[1])
  assert.equal(lido.get('q'), 'Sónia Pais')
  assert.equal(lido.get('papel'), 'aluno')
})
