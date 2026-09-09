/**
 * Extrai o símbolo (a cabeça de cavalo) do logótipo do clube.
 *
 *   node scripts/extrair-simbolo.mjs
 *
 * O logótipo é um lockup: símbolo à esquerda e o nome do clube à direita. Isso
 * é bom em grande, mas a 36px na barra lateral o lettering vira uma mancha —
 * e fica a repetir o nome que já está escrito ao lado. Daí um símbolo à parte.
 *
 * O recorte não pode ser uma banda vertical: o focinho do cavalo e o lettering
 * sobrepõem-se na horizontal. As coordenadas abaixo são as da cabeça neste
 * logótipo, encontradas a olho e confirmadas visualmente; se o logótipo mudar,
 * têm de ser revistas. Depois do recorte, o `trim` encosta o resultado ao
 * conteúdo, e o quadrado final é preenchido com a cor de fundo do original.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const MARCA = join(RAIZ, 'public', 'marca')

const RECORTE_CABECA = { left: 180, top: 100, width: 500, height: 440 }
const LADO = 512
const OCUPACAO = 0.72 // quanto do quadrado o símbolo preenche

const EXTENSOES = ['png', 'jpg', 'jpeg', 'webp']
const origem = EXTENSOES.map((e) => join(MARCA, `logotipo.${e}`)).find((c) =>
  existsSync(c),
)

if (!origem) {
  console.error('Não há public/marca/logotipo.* para extrair o símbolo.')
  process.exit(1)
}

mkdirSync(MARCA, { recursive: true })

const recortado = await sharp(origem).extract(RECORTE_CABECA).png().toBuffer()
const { data: simbolo, info } = await sharp(recortado)
  .trim({ threshold: 12 })
  .toBuffer({ resolveWithObject: true })

// Cor de fundo: um pixel do canto do logótipo, que é fundo liso.
const { data: canto } = await sharp(origem)
  .extract({ left: 0, top: 0, width: 1, height: 1 })
  .raw()
  .toBuffer({ resolveWithObject: true })
const fundo = { r: canto[0], g: canto[1], b: canto[2], alpha: 1 }

const interior = Math.round(LADO * OCUPACAO)
const redimensionado = await sharp(simbolo)
  .resize(interior, interior, { fit: 'inside' })
  .toBuffer({ resolveWithObject: true })

await sharp({
  create: { width: LADO, height: LADO, channels: 4, background: fundo },
})
  .composite([
    {
      input: redimensionado.data,
      top: Math.round((LADO - redimensionado.info.height) / 2),
      left: Math.round((LADO - redimensionado.info.width) / 2),
    },
  ])
  .png()
  .toFile(join(MARCA, 'simbolo.png'))

console.log(
  `Símbolo extraído (${info.width}x${info.height} → ${LADO}x${LADO}) em public/marca/simbolo.png`,
)
