import { test } from 'node:test'
import assert from 'node:assert/strict'
import { descodificarQuotedPrintable, lerVCards, linhasLogicas } from './vcard.ts'

/** O que o iPhone produz em «Partilhar contacto → Guardar em Ficheiros». */
const IPHONE = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  'N:Ferreira;Ana;Maria;;',
  'FN:Ana Maria Ferreira',
  'TEL;type=HOME;type=VOICE:263 123 456',
  'TEL;type=CELL;type=VOICE;type=pref:+351 912 345 678',
  'EMAIL;type=INTERNET;type=HOME;type=pref:ana@exemplo.pt',
  'item1.ADR;type=HOME;type=pref:;;Rua das Flores 12;Santarém;;2000-100;Portugal',
  'END:VCARD',
].join('\r\n')

test('lê um cartão do iPhone', () => {
  const [contacto] = lerVCards(IPHONE)
  assert.equal(contacto.nome, 'Ana Maria Ferreira')
  assert.equal(contacto.email, 'ana@exemplo.pt')
  assert.equal(contacto.morada, 'Rua das Flores 12, 2000-100 Santarém, Portugal')
})

test('entre vários telefones escolhe o telemóvel', () => {
  const [contacto] = lerVCards(IPHONE)
  assert.equal(contacto.telefone, '+351 912 345 678')
})

test('o fax nunca é escolhido à frente de outro número', () => {
  const [contacto] = lerVCards(
    [
      'BEGIN:VCARD',
      'TEL;TYPE=FAX:263 000 000',
      'TEL;TYPE=WORK:263 111 111',
      'END:VCARD',
    ].join('\n'),
  )
  assert.equal(contacto.telefone, '263 111 111')
})

test('junta as linhas dobradas da norma', () => {
  // O espaço da continuação é a marca da dobra e desaparece — por isso as
  // dobras caem a meio de uma palavra, e juntar tem de ser sem espaço.
  const [contacto] = lerVCards(
    ['BEGIN:VCARD', 'FN:Ana Maria Ferrei', ' ra da Silva', 'END:VCARD'].join(
      '\r\n',
    ),
  )
  assert.equal(contacto.nome, 'Ana Maria Ferreira da Silva')
})

test('junta as linhas dobradas do quoted-printable, que não levam espaço', () => {
  const linhas = linhasLogicas(
    [
      'FN;ENCODING=QUOTED-PRINTABLE:Ana Maria =',
      'Ferreira',
      'TEL:912345678',
    ].join('\r\n'),
  )
  assert.deepEqual(linhas, [
    'FN;ENCODING=QUOTED-PRINTABLE:Ana Maria Ferreira',
    'TEL:912345678',
  ])
})

test('descodifica quoted-printable em UTF-8', () => {
  // «Santarém» com o é em dois octetos, que é como o Android o escreve.
  assert.equal(descodificarQuotedPrintable('Santar=C3=A9m'), 'Santarém')
  assert.equal(descodificarQuotedPrintable('Jo=C3=A3o'), 'João')
  // Um `=` que não abra um par hexadecimal fica como está.
  assert.equal(descodificarQuotedPrintable('a=b'), 'a=b')
})

test('lê um cartão do Android, com acentos em quoted-printable', () => {
  const [contacto] = lerVCards(
    [
      'BEGIN:VCARD',
      'VERSION:2.1',
      'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Sim=C3=B5es;Jo=C3=A3o;;;',
      'TEL;CELL:912345678',
      'END:VCARD',
    ].join('\r\n'),
  )
  assert.equal(contacto.nome, 'João Simões')
  assert.equal(contacto.telefone, '912345678')
})

test('sem FN, monta o nome a partir do N', () => {
  const [contacto] = lerVCards(
    ['BEGIN:VCARD', 'N:Ferreira;Ana;Maria;;', 'END:VCARD'].join('\n'),
  )
  assert.equal(contacto.nome, 'Ana Maria Ferreira')
})

test('não corta nos pontos e vírgulas escapados', () => {
  const [contacto] = lerVCards(
    [
      'BEGIN:VCARD',
      'FN:Silva\\, Ana',
      'ADR:;;Rua A\\; lote 3;Lisboa;;1000-000;',
      'END:VCARD',
    ].join('\n'),
  )
  assert.equal(contacto.nome, 'Silva, Ana')
  assert.equal(contacto.morada, 'Rua A; lote 3, 1000-000 Lisboa')
})

test('lê vários cartões do mesmo ficheiro', () => {
  const contactos = lerVCards(
    [IPHONE, ['BEGIN:VCARD', 'FN:Rui Costa', 'TEL:961000000', 'END:VCARD'].join('\r\n')].join(
      '\r\n',
    ),
  )
  assert.equal(contactos.length, 2)
  assert.equal(contactos[1].nome, 'Rui Costa')
})

test('um ficheiro sem nada de útil devolve lista vazia', () => {
  assert.deepEqual(lerVCards(''), [])
  assert.deepEqual(lerVCards('isto não é um vCard'), [])
  assert.deepEqual(lerVCards('BEGIN:VCARD\r\nVERSION:3.0\r\nEND:VCARD'), [])
})

test('campos em falta ficam a null, não a vazio', () => {
  const [contacto] = lerVCards('BEGIN:VCARD\nFN:Rui\nEND:VCARD')
  assert.equal(contacto.nome, 'Rui')
  assert.equal(contacto.telefone, null)
  assert.equal(contacto.email, null)
  assert.equal(contacto.morada, null)
})
