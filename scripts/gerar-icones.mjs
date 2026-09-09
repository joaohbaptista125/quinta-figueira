/**
 * Gera os ícones da PWA (public/icones/) sem depender de ferramentas de imagem.
 *
 *   node scripts/gerar-icones.mjs
 *
 * O desenho é uma ferradura clara sobre o verde da marca, rasterizada com
 * sobreamostragem 4x. Escreve PNG RGBA à mão: um IHDR, um IDAT comprimido com
 * zlib e um IEND.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const DESTINO = join(RAIZ, 'public', 'icones')

const VERDE = [0x2f, 0x5b, 0x45]
const CREME = [0xf3, 0xef, 0xe4]

// --- Codificação PNG --------------------------------------------------------

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tabela[n] = c >>> 0
  }
  return tabela
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function bloco(tipo, dados) {
  const comprimento = Buffer.alloc(4)
  comprimento.writeUInt32BE(dados.length)
  const corpo = Buffer.concat([Buffer.from(tipo, 'latin1'), dados])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(corpo))
  return Buffer.concat([comprimento, corpo, crc])
}

function codificarPng(largura, altura, rgba) {
  const cabecalho = Buffer.alloc(13)
  cabecalho.writeUInt32BE(largura, 0)
  cabecalho.writeUInt32BE(altura, 4)
  cabecalho[8] = 8 // profundidade de bits
  cabecalho[9] = 6 // RGBA
  // 10-12: compressão, filtro e entrelaçamento, todos no valor por omissão (0)

  // Cada linha é precedida do byte de filtro (0 = sem filtro).
  const cru = Buffer.alloc(altura * (1 + largura * 4))
  for (let y = 0; y < altura; y++) {
    const inicioLinha = y * (1 + largura * 4)
    cru[inicioLinha] = 0
    rgba.copy(cru, inicioLinha + 1, y * largura * 4, (y + 1) * largura * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', cabecalho),
    bloco('IDAT', deflateSync(cru, { level: 9 })),
    bloco('IEND', Buffer.alloc(0)),
  ])
}

// --- Desenho ----------------------------------------------------------------

const GRAU = Math.PI / 180

/** Devolve 1 se o ponto (x, y), em coordenadas 0..1, cai na ferradura. */
function naFerradura(x, y, escala) {
  const cx = 0.5
  const cy = 0.47
  const raioExterior = 0.3 * escala
  const raioInterior = 0.185 * escala
  const meia = (raioExterior - raioInterior) / 2
  const raioMedio = (raioExterior + raioInterior) / 2

  const dx = x - cx
  const dy = cy - y // eixo y para cima
  const distancia = Math.hypot(dx, dy)
  const angulo = Math.atan2(dy, dx)

  // Abertura da ferradura, virada para baixo.
  const inicioAbertura = -115 * GRAU
  const fimAbertura = -65 * GRAU
  const naAbertura = angulo > inicioAbertura && angulo < fimAbertura

  const noArco =
    !naAbertura && distancia >= raioInterior && distancia <= raioExterior

  // Pontas arredondadas nos dois extremos do arco.
  const pontas = [inicioAbertura, fimAbertura].some((anguloPonta) => {
    const px = cx + Math.cos(anguloPonta) * raioMedio
    const py = cy - Math.sin(anguloPonta) * raioMedio
    return Math.hypot(x - px, y - py) <= meia
  })

  if (!noArco && !pontas) return 0

  // Furos dos cravos, distribuídos ao longo da ferradura.
  for (let i = 0; i < 6; i++) {
    const anguloFuro = (-50 + i * 52) * GRAU
    const fx = cx + Math.cos(anguloFuro) * raioMedio
    const fy = cy - Math.sin(anguloFuro) * raioMedio
    if (Math.hypot(x - fx, y - fy) <= meia * 0.34) return 0
  }

  return 1
}

function desenhar(tamanho, escalaGlifo) {
  const amostras = 4
  const rgba = Buffer.alloc(tamanho * tamanho * 4)

  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      let cobertura = 0
      for (let sy = 0; sy < amostras; sy++) {
        for (let sx = 0; sx < amostras; sx++) {
          const px = (x + (sx + 0.5) / amostras) / tamanho
          const py = (y + (sy + 0.5) / amostras) / tamanho
          cobertura += naFerradura(px, py, escalaGlifo)
        }
      }
      cobertura /= amostras * amostras

      const i = (y * tamanho + x) * 4
      for (let canal = 0; canal < 3; canal++) {
        rgba[i + canal] = Math.round(
          VERDE[canal] * (1 - cobertura) + CREME[canal] * cobertura,
        )
      }
      rgba[i + 3] = 255
    }
  }

  return codificarPng(tamanho, tamanho, rgba)
}

mkdirSync(DESTINO, { recursive: true })

for (const tamanho of [192, 512]) {
  writeFileSync(join(DESTINO, `icone-${tamanho}.png`), desenhar(tamanho, 1))
}

// Versão "maskable": o glifo encolhe para caber na zona segura de 80% que os
// sistemas operativos recortam.
writeFileSync(join(DESTINO, 'icone-maskable-512.png'), desenhar(512, 0.72))

console.log('Ícones gerados em public/icones/')
