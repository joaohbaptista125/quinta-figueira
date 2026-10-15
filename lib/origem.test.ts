import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escolherOrigem } from './origem.ts'

test('o que está configurado manda', () => {
  assert.equal(
    escolherOrigem('https://quintadafigueira.pt', 'quintadafigueira.pt', 'https'),
    'https://quintadafigueira.pt',
  )
})

test('a barra do fim não entra nos links', () => {
  assert.equal(
    escolherOrigem('https://exemplo.pt/', 'exemplo.pt', 'https'),
    'https://exemplo.pt',
  )
})

test('sem nada configurado, a origem vem do pedido', () => {
  assert.equal(
    escolherOrigem(undefined, 'quinta.vercel.app', 'https'),
    'https://quinta.vercel.app',
  )
})

test('um localhost configurado em produção é ignorado', () => {
  // O caso que mandou um convite com link para localhost a uma pessoa real.
  assert.equal(
    escolherOrigem('http://localhost:3000', 'quinta.vercel.app', 'https'),
    'https://quinta.vercel.app',
  )
})

test('127.0.0.1 conta como local, tal como o nome', () => {
  assert.equal(
    escolherOrigem('http://127.0.0.1:3000', 'quinta.vercel.app', 'https'),
    'https://quinta.vercel.app',
  )
})

test('em desenvolvimento nada muda', () => {
  assert.equal(
    escolherOrigem('http://localhost:3000', 'localhost:3000', 'http'),
    'http://localhost:3000',
  )
})

test('um valor configurado que não é um endereço é usado tal como está', () => {
  assert.equal(escolherOrigem('nao-e-um-url', 'exemplo.pt', 'https'), 'nao-e-um-url')
})

test('sem pedido e sem configuração, sobra o endereço de desenvolvimento', () => {
  assert.equal(escolherOrigem(undefined, null, 'https'), 'http://localhost:3000')
})

test('configuração vazia é o mesmo que não ter nenhuma', () => {
  assert.equal(escolherOrigem('   ', 'exemplo.pt', 'https'), 'https://exemplo.pt')
})
