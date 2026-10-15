import { test } from 'node:test'
import assert from 'node:assert/strict'
import { traduzirErroAutenticacao } from './resultado.ts'

test('um 500 do envio aponta para o SMTP, e não para limites', () => {
  const mensagem = traduzirErroAutenticacao({
    status: 500,
    code: 'unexpected_failure',
    message: 'Error sending magic link email',
  })
  assert.match(mensagem, /SMTP/)
  assert.doesNotMatch(mensagem, /limite/i)
})

test('«Error sending» chega sem estado e é reconhecido na mesma', () => {
  assert.match(
    traduzirErroAutenticacao({ message: 'Error sending confirmation email' }),
    /SMTP/,
  )
})

test('o limite por hora só é apontado quando é mesmo o limite', () => {
  const mensagem = traduzirErroAutenticacao({
    status: 429,
    code: 'over_email_send_rate_limit',
    message: 'For security purposes, you can only request this after 56 seconds.',
  })
  assert.match(mensagem, /Rate Limits/)
})

test('contas por email desligadas dizem onde se ligam', () => {
  assert.match(
    traduzirErroAutenticacao({ status: 422, code: 'signup_disabled' }),
    /Providers/,
  )
})

test('a mensagem crua viaja sempre, para poder ser repetida ao telefone', () => {
  assert.match(
    traduzirErroAutenticacao({ status: 400, message: 'Something odd happened' }),
    /\(Something odd happened\)/,
  )
})

test('sem mensagem nenhuma, não se inventa uma causa', () => {
  const mensagem = traduzirErroAutenticacao({})
  assert.match(mensagem, /não disse porquê/)
  assert.doesNotMatch(mensagem, /\(\)/)
})
