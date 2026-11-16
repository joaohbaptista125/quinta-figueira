import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  elastico,
  molaAssentou,
  MOLA_FOLHA,
  MOLA_MOVER,
  passoDaMola,
  repousoProjectado,
  type EstadoMola,
  type ParametrosMola,
} from './mola.ts'

/** Corre a mola até assentar, e devolve o caminho todo. */
function correr(
  parametros: ParametrosMola,
  inicio: EstadoMola,
  alvo: number,
  dt = 1 / 60,
  maximo = 600,
) {
  const caminho: EstadoMola[] = [inicio]
  let estado = inicio
  for (let i = 0; i < maximo; i += 1) {
    estado = passoDaMola(parametros, estado, alvo, dt)
    caminho.push(estado)
    if (molaAssentou(estado, alvo)) break
  }
  return caminho
}

test('o amortecimento crítico nunca passa do destino', () => {
  const caminho = correr(MOLA_MOVER, { posicao: 0, velocidade: 0 }, 100)
  for (const { posicao } of caminho) {
    assert.ok(
      posicao <= 100 + 1e-6,
      `passou do destino: ${posicao}`,
    )
  }
  assert.ok(molaAssentou(caminho.at(-1)!, 100))
})

test('abaixo de 1 ressalta — é para isso que serve', () => {
  const caminho = correr(MOLA_FOLHA, { posicao: 0, velocidade: 0 }, 100)
  const maximo = Math.max(...caminho.map((e) => e.posicao))
  assert.ok(maximo > 100, `devia ter passado dos 100, chegou a ${maximo}`)
  assert.ok(maximo < 120, `ressalto exagerado: ${maximo}`)
})

test('assenta no destino, venha de onde vier', () => {
  for (const inicio of [-320, -50, 0, 37, 500]) {
    for (const velocidade of [-2000, 0, 1500]) {
      const fim = correr(
        MOLA_MOVER,
        { posicao: inicio, velocidade },
        0,
        1 / 60,
        2000,
      ).at(-1)!
      assert.ok(
        molaAssentou(fim, 0),
        `não assentou de ${inicio} a ${velocidade}px/s: ${JSON.stringify(fim)}`,
      )
    }
  }
})

/*
 * O que esta prova é o motivo de a mola ser resolvida analiticamente: num
 * telemóvel a engasgar, um fotograma pode valer 100 ms. Com um integrador
 * passo a passo, o resultado desses saltos divergia do caminho normal —
 * e é precisamente aí, quando já está a correr mal, que começava a correr
 * pior.
 */
test('um salto grande dá o mesmo que muitos passos pequenos', () => {
  const inicio: EstadoMola = { posicao: 240, velocidade: -600 }

  let miudo = inicio
  for (let i = 0; i < 10; i += 1) {
    miudo = passoDaMola(MOLA_FOLHA, miudo, 0, 0.01)
  }
  const graudo = passoDaMola(MOLA_FOLHA, inicio, 0, 0.1)

  assert.ok(Math.abs(miudo.posicao - graudo.posicao) < 1e-6)
  assert.ok(Math.abs(miudo.velocidade - graudo.velocidade) < 1e-6)
})

test('a velocidade inicial empurra mesmo a mola', () => {
  const parado = passoDaMola(
    MOLA_MOVER,
    { posicao: 0, velocidade: 0 },
    100,
    0.05,
  )
  const lancado = passoDaMola(
    MOLA_MOVER,
    { posicao: 0, velocidade: 800 },
    100,
    0.05,
  )
  assert.ok(
    lancado.posicao > parado.posicao,
    'largar com velocidade tem de chegar mais longe no mesmo tempo',
  )
})

test('uma mola sobreamortecida também assenta, e sem oscilar', () => {
  const lenta: ParametrosMola = { amortecimento: 1.6, resposta: 0.4 }
  const caminho = correr(lenta, { posicao: 200, velocidade: 0 }, 0, 1 / 60, 2000)
  for (const { posicao } of caminho) {
    assert.ok(posicao >= -1e-6, `oscilou para lá do destino: ${posicao}`)
  }
  assert.ok(molaAssentou(caminho.at(-1)!, 0))
})

test('`dt` nulo ou negativo não mexe no estado', () => {
  const estado = { posicao: 12, velocidade: -3 }
  assert.deepEqual(passoDaMola(MOLA_MOVER, estado, 0, 0), estado)
  assert.deepEqual(passoDaMola(MOLA_MOVER, estado, 0, -1), estado)
})

// --- Projecção de inércia ---------------------------------------------------

test('sem velocidade, pára onde está', () => {
  assert.equal(repousoProjectado(120, 0), 120)
})

test('a projecção vai no sentido do gesto e cresce com ele', () => {
  const devagar = repousoProjectado(0, 400)
  const depressa = repousoProjectado(0, 2000)
  assert.ok(devagar > 0)
  assert.ok(depressa > devagar)
  assert.ok(repousoProjectado(0, -2000) < 0)
})

/*
 * O caso que justifica a projecção existir: um puxão curto e rápido para
 * baixo é «fecha isto», mesmo com o painel ainda quase todo no ecrã. Quem
 * decidir pela posição em que o dedo largou lê isto como «mantém aberto».
 */
test('um puxão curto e rápido projecta-se para lá do limite', () => {
  const altura = 420
  const limite = altura * 0.35
  const posicaoAoLargar = 40

  assert.ok(posicaoAoLargar < limite, 'o dedo largou antes do limite')
  assert.ok(repousoProjectado(posicaoAoLargar, 1800) > limite)
})

// --- Elástico ---------------------------------------------------------------

test('sem excesso não há elástico', () => {
  assert.equal(elastico(0, 400), 0)
})

test('o elástico anda sempre menos do que o dedo', () => {
  for (const excesso of [10, 50, 200, 1000]) {
    assert.ok(elastico(excesso, 400) < excesso)
  }
})

test('por muito que se puxe, há um tecto — e é a dimensão', () => {
  for (const excesso of [1000, 10000, 1e6]) {
    assert.ok(elastico(excesso, 400) < 400)
  }
  assert.ok(elastico(1e9, 400) > 399, 'devia aproximar-se da dimensão')
})

test('puxar uma superfície inteira anda ~35% dela', () => {
  // c / (1 + c) com c = 0,55. É este número que se sente no dedo, e não o
  // tecto teórico — ninguém puxa mil píxeis.
  const andou = elastico(400, 400)
  assert.ok(Math.abs(andou / 400 - 0.55 / 1.55) < 1e-9)
})

test('o elástico é simétrico', () => {
  assert.equal(elastico(-120, 400), -elastico(120, 400))
})

test('o elástico é monótono — puxar mais nunca anda menos', () => {
  let anterior = 0
  for (let excesso = 1; excesso <= 500; excesso += 7) {
    const actual = elastico(excesso, 400)
    assert.ok(actual > anterior)
    anterior = actual
  }
})
