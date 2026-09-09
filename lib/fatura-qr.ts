/**
 * Leitura do QR code das faturas portuguesas.
 *
 * Desde 2022 todos os documentos fiscais emitidos em Portugal trazem um QR
 * code com um conteúdo normalizado pela AT (Despacho n.º 3021/2021-XXII).
 * É texto simples: campos separados por `*`, cada um `CHAVE:VALOR`.
 *
 *   A:501442600*B:999999990*C:PT*D:FT*E:N*F:20260907*G:FT AB2026/0035*
 *   H:CSDF7T5H-0035*I1:PT*I7:600.00*I8:138.00*N:138.00*O:738.00*Q:kLp0*R:9999
 *
 * Ler o QR é bastante melhor do que reconhecer texto numa fotografia: os
 * valores vêm exactos, já separados por taxa de IVA, e não há nada a adivinhar.
 *
 * Este ficheiro é uma função pura, sem dependências — o descodificador da
 * imagem vive em components/leitor-fatura.tsx.
 */

/** Campos do QR que nos interessam, já convertidos. */
export type FaturaLida = {
  /** NIF de quem emitiu a fatura — o fornecedor. */
  nifEmitente: string | null
  /** NIF de quem a recebeu. Serve para avisar se a fatura não é do centro. */
  nifAdquirente: string | null
  /** Tipo de documento: FT fatura, FS fatura simplificada, FR fatura-recibo… */
  tipoDocumento: string | null
  /** Data do documento, em 'AAAA-MM-DD'. */
  data: string | null
  /** Identificação do documento, ex. 'FT AB2026/0035'. */
  numeroDocumento: string | null
  /** Total do documento com impostos incluídos. */
  total: number | null
  /** Total de impostos. */
  totalImpostos: number | null
  /** Bases e IVA por taxa, somando continente, Açores e Madeira. */
  porTaxa: { taxa: 6 | 13 | 23; base: number; iva: number }[]
  /** A taxa com maior base tributável, que é a que o formulário assume. */
  taxaDominante: 6 | 13 | 23 | 0 | null
  /** Verdadeiro se a fatura tem valores em mais do que uma taxa de IVA. */
  variasTaxas: boolean
  /** Documento anulado (campo E = 'A'). Não deve ser lançado. */
  anulado: boolean
}

/** Reconhece um conteúdo de QR como sendo o de uma fatura portuguesa. */
export function pareceFaturaPortuguesa(texto: string) {
  // O campo A (NIF do emitente) e o O (total) são obrigatórios em todos os
  // documentos; a presença de ambos separa isto de qualquer outro QR.
  return /(^|\*)A:\d{9}(\*|$)/.test(texto) && /(^|\*)O:/.test(texto)
}

function lerNumero(valor: string | undefined) {
  if (valor == null || valor.trim() === '') return null
  // A especificação usa ponto decimal, sem separador de milhares.
  const n = Number(valor.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function somar(...valores: (number | null)[]) {
  const presentes = valores.filter((v): v is number => v != null)
  if (presentes.length === 0) return 0
  return presentes.reduce((a, b) => a + b, 0)
}

/**
 * Converte o conteúdo do QR num objecto. Devolve null se não for uma fatura.
 * Tolera campos em falta: emissores diferentes preenchem conjuntos diferentes.
 */
export function lerFaturaQr(texto: string): FaturaLida | null {
  if (!texto || !pareceFaturaPortuguesa(texto)) return null

  const campos = new Map<string, string>()
  for (const parte of texto.split('*')) {
    const separador = parte.indexOf(':')
    if (separador <= 0) continue
    campos.set(parte.slice(0, separador).trim(), parte.slice(separador + 1))
  }

  const data = campos.get('F')
  const dataIso =
    data && /^\d{8}$/.test(data)
      ? `${data.slice(0, 4)}-${data.slice(4, 6)}-${data.slice(6, 8)}`
      : null

  // I* é o continente, J* os Açores e K* a Madeira. As taxas diferem entre
  // regiões, mas para efeitos de lançamento o que importa é a base e o IVA.
  const porTaxa: FaturaLida['porTaxa'] = (
    [
      { taxa: 6 as const, base: ['I3', 'J3', 'K3'], iva: ['I4', 'J4', 'K4'] },
      { taxa: 13 as const, base: ['I5', 'J5', 'K5'], iva: ['I6', 'J6', 'K6'] },
      { taxa: 23 as const, base: ['I7', 'J7', 'K7'], iva: ['I8', 'J8', 'K8'] },
    ] as const
  )
    .map(({ taxa, base, iva }) => ({
      taxa,
      base: somar(...base.map((c) => lerNumero(campos.get(c)))),
      iva: somar(...iva.map((c) => lerNumero(campos.get(c)))),
    }))
    .filter((linha) => linha.base > 0 || linha.iva > 0)

  const comIva = porTaxa.filter((linha) => linha.iva > 0)
  const dominante = [...porTaxa].sort((a, b) => b.base - a.base)[0]

  // Sem nenhuma linha de IVA a fatura é isenta — o formulário usa taxa 0.
  const taxaDominante: FaturaLida['taxaDominante'] =
    comIva.length > 0 ? (dominante?.taxa ?? null) : porTaxa.length > 0 ? 0 : 0

  return {
    nifEmitente: campos.get('A')?.trim() || null,
    nifAdquirente: campos.get('B')?.trim() || null,
    tipoDocumento: campos.get('D')?.trim() || null,
    data: dataIso,
    numeroDocumento: campos.get('G')?.trim() || null,
    total: lerNumero(campos.get('O')),
    totalImpostos: lerNumero(campos.get('N')),
    porTaxa,
    taxaDominante,
    variasTaxas: comIva.length > 1,
    anulado: campos.get('E')?.trim().toUpperCase() === 'A',
  }
}

/** Descrição curta do tipo de documento, para mostrar a quem lança. */
export const TIPOS_DOCUMENTO: Record<string, string> = {
  FT: 'Fatura',
  FS: 'Fatura simplificada',
  FR: 'Fatura-recibo',
  ND: 'Nota de débito',
  NC: 'Nota de crédito',
  RC: 'Recibo',
  RG: 'Recibo',
}
