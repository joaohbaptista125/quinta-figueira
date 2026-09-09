import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lerFaturaQr, pareceFaturaPortuguesa } from './fatura-qr.ts'

// Exemplo com a forma do Despacho 3021/2021: taxa normal, 600,00 + 138,00.
const FATURA_23 =
  'A:501442600*B:999999990*C:PT*D:FT*E:N*F:20260907*G:FT AB2026/0035*' +
  'H:CSDF7T5H-0035*I1:PT*I7:600.00*I8:138.00*N:138.00*O:738.00*Q:kLp0*R:9999'

// Ração leva taxa reduzida: 696,23 + 41,77 = 738,00.
const FATURA_6 =
  'A:500000001*B:999999990*C:PT*D:FT*E:N*F:20260901*G:FT 2026/117*' +
  'H:ABCD1234-117*I1:PT*I3:696.23*I4:41.77*N:41.77*O:738.00*Q:aB1c*R:1234'

test('lê uma fatura à taxa normal', () => {
  const fatura = lerFaturaQr(FATURA_23)
  assert.ok(fatura)
  assert.equal(fatura.nifEmitente, '501442600')
  assert.equal(fatura.data, '2026-09-07')
  assert.equal(fatura.numeroDocumento, 'FT AB2026/0035')
  assert.equal(fatura.total, 738)
  assert.equal(fatura.totalImpostos, 138)
  assert.equal(fatura.taxaDominante, 23)
  assert.equal(fatura.variasTaxas, false)
  assert.equal(fatura.anulado, false)
})

test('lê uma fatura à taxa reduzida', () => {
  const fatura = lerFaturaQr(FATURA_6)
  assert.ok(fatura)
  assert.equal(fatura.taxaDominante, 6)
  assert.equal(fatura.total, 738)
  assert.deepEqual(fatura.porTaxa, [{ taxa: 6, base: 696.23, iva: 41.77 }])
})

test('o total e o IVA lidos reconstituem a base', () => {
  const fatura = lerFaturaQr(FATURA_6)!
  const base = fatura.porTaxa[0].base
  assert.equal(Number((base + fatura.totalImpostos!).toFixed(2)), fatura.total)
})

test('assinala faturas com mais do que uma taxa', () => {
  const fatura = lerFaturaQr(
    'A:500000001*B:999999990*D:FT*E:N*F:20260901*G:FT 2026/9*' +
      'I3:100.00*I4:6.00*I7:200.00*I8:46.00*N:52.00*O:352.00',
  )
  assert.ok(fatura)
  assert.equal(fatura.variasTaxas, true)
  // A taxa dominante é a da maior base tributável, não a maior taxa.
  assert.equal(fatura.taxaDominante, 23)
  assert.equal(fatura.porTaxa.length, 2)
})

test('soma as bases das regiões autónomas', () => {
  const fatura = lerFaturaQr(
    'A:500000001*D:FT*E:N*F:20260901*G:FT 2026/10*' +
      'I7:100.00*I8:23.00*J7:50.00*J8:8.00*N:31.00*O:181.00',
  )
  assert.ok(fatura)
  assert.deepEqual(fatura.porTaxa, [{ taxa: 23, base: 150, iva: 31 }])
})

test('trata como isenta uma fatura sem linhas de IVA', () => {
  const fatura = lerFaturaQr(
    'A:500000001*D:FS*E:N*F:20260901*G:FS 2026/3*I2:80.00*N:0.00*O:80.00',
  )
  assert.ok(fatura)
  assert.equal(fatura.taxaDominante, 0)
  assert.equal(fatura.total, 80)
})

test('assinala documentos anulados', () => {
  const fatura = lerFaturaQr(FATURA_23.replace('E:N', 'E:A'))
  assert.ok(fatura)
  assert.equal(fatura.anulado, true)
})

test('tolera campos em falta sem rebentar', () => {
  const fatura = lerFaturaQr('A:500000001*O:12.34')
  assert.ok(fatura)
  assert.equal(fatura.total, 12.34)
  assert.equal(fatura.data, null)
  assert.equal(fatura.numeroDocumento, null)
  assert.deepEqual(fatura.porTaxa, [])
})

test('ignora QR codes que não são faturas', () => {
  for (const texto of [
    'https://quintadafigueira.pt',
    'WIFI:S:cavalarica;T:WPA;P:12345678;;',
    'A:12345*O:10',
    '',
  ]) {
    assert.equal(pareceFaturaPortuguesa(texto), false, texto)
    assert.equal(lerFaturaQr(texto), null, texto)
  }
})

test('não confunde uma data mal formada com uma válida', () => {
  const fatura = lerFaturaQr('A:500000001*F:07-09-2026*O:10.00')
  assert.ok(fatura)
  assert.equal(fatura.data, null)
})
