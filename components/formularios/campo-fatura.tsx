'use client'

import { useRef, useState } from 'react'
import jsQR from 'jsqr'
import { CampoFicheiro } from '@/components/campo-ficheiro'
import { Botao } from '@/components/ui/botao'
import { Aviso } from '@/components/ui/superficie'
import { formatarData, formatarEuros } from '@/lib/formatos'
import { lerFaturaQr, TIPOS_DOCUMENTO, type FaturaLida } from '@/lib/fatura-qr'

export type FornecedorConhecido = { id: string; nome: string; nif: string | null }

type Leitura =
  | { fase: 'nada' }
  | { fase: 'a-ler' }
  | { fase: 'lida'; fatura: FaturaLida; aplicada: boolean }
  | { fase: 'sem-qr'; motivo: string }

/**
 * Campo da fatura digitalizada que também a lê.
 *
 * Todos os documentos fiscais emitidos em Portugal desde 2022 trazem um QR
 * code com os campos normalizados pela AT. Descodificá-lo dá os valores
 * exactos — total, data, taxa de IVA, NIF do emitente — sem reconhecimento de
 * texto e sem margem para engano.
 *
 * A leitura nunca escreve por cima do que já está preenchido sem autorização:
 * mostra o que encontrou e espera que a pessoa carregue em «Preencher».
 */
export function CampoFatura({
  fornecedores,
  valorInicial,
}: {
  fornecedores: FornecedorConhecido[]
  valorInicial?: string | null
}) {
  const [leitura, setLeitura] = useState<Leitura>({ fase: 'nada' })
  const ancora = useRef<HTMLDivElement>(null)

  async function tentarLerQr(ficheiro: File) {
    if (!ficheiro.type.startsWith('image/')) {
      setLeitura({
        fase: 'sem-qr',
        motivo:
          'Só consigo ler o QR de fotografias. Num PDF, o ficheiro é guardado à mesma — preencha os valores à mão.',
      })
      return
    }

    setLeitura({ fase: 'a-ler' })

    try {
      const bitmap = await createImageBitmap(ficheiro)
      // Duas passagens: primeiro reduzida, que é mais rápida e costuma chegar;
      // depois no tamanho original, para QR pequenos numa foto grande.
      for (const larguraAlvo of [1400, bitmap.width]) {
        const conteudo = descodificar(bitmap, larguraAlvo)
        const fatura = conteudo ? lerFaturaQr(conteudo) : null
        if (fatura) {
          bitmap.close()
          setLeitura({ fase: 'lida', fatura, aplicada: false })
          return
        }
      }
      bitmap.close()
      setLeitura({
        fase: 'sem-qr',
        motivo:
          'Não encontrei o QR code nesta imagem. Tente uma fotografia mais próxima e direita do quadrado, ou preencha à mão.',
      })
    } catch {
      setLeitura({
        fase: 'sem-qr',
        motivo: 'Não foi possível ler a imagem. Preencha os valores à mão.',
      })
    }
  }

  function preencher(fatura: FaturaLida) {
    const formulario = ancora.current?.closest('form')
    if (!formulario) return

    const definir = (nome: string, valor: string) => {
      const campo = formulario.elements.namedItem(nome)
      if (campo instanceof HTMLInputElement || campo instanceof HTMLSelectElement) {
        campo.value = valor
      }
    }

    if (fatura.total != null) definir('valor_total', fatura.total.toFixed(2))
    if (fatura.data) definir('data', fatura.data)
    if (fatura.taxaDominante != null) definir('taxa_iva', String(fatura.taxaDominante))

    const fornecedor = fatura.nifEmitente
      ? fornecedores.find((f) => f.nif === fatura.nifEmitente)
      : undefined
    if (fornecedor) definir('fornecedor_id', fornecedor.id)

    // A descrição é do domínio de quem lança; só sugerimos se estiver vazia.
    const descricao = formulario.elements.namedItem('descricao')
    if (
      descricao instanceof HTMLInputElement &&
      descricao.value.trim() === '' &&
      fatura.numeroDocumento
    ) {
      descricao.value = fatura.numeroDocumento
    }

    setLeitura({ fase: 'lida', fatura, aplicada: true })
  }

  return (
    <div ref={ancora} className="space-y-2">
      <CampoFicheiro
        name="anexo_path"
        bucket="documentos"
        prefixo={`despesas/${new Date().getFullYear()}/`}
        accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
        valorInicial={valorInicial}
        tamanhoMaximoMB={20}
        aoEscolher={tentarLerQr}
      />

      {leitura.fase === 'a-ler' ? (
        <p className="text-xs text-muted-foreground">A procurar o QR code…</p>
      ) : null}

      {leitura.fase === 'sem-qr' ? (
        <p className="text-xs text-muted-foreground">{leitura.motivo}</p>
      ) : null}

      {leitura.fase === 'lida' ? (
        <ResumoLeitura
          fatura={leitura.fatura}
          aplicada={leitura.aplicada}
          fornecedor={
            leitura.fatura.nifEmitente
              ? fornecedores.find((f) => f.nif === leitura.fatura.nifEmitente)
              : undefined
          }
          aoPreencher={() => preencher(leitura.fatura)}
        />
      ) : null}
    </div>
  )
}

function ResumoLeitura({
  fatura,
  aplicada,
  fornecedor,
  aoPreencher,
}: {
  fatura: FaturaLida
  aplicada: boolean
  fornecedor?: FornecedorConhecido
  aoPreencher: () => void
}) {
  const tipo = fatura.tipoDocumento
    ? (TIPOS_DOCUMENTO[fatura.tipoDocumento] ?? fatura.tipoDocumento)
    : 'Documento'

  return (
    <div className="rounded-md border border-primary/30 bg-primary/8 p-3">
      <p className="text-sm font-medium">
        {tipo} lido do QR code
        {fatura.numeroDocumento ? ` · ${fatura.numeroDocumento}` : ''}
      </p>

      <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        {fatura.total != null ? (
          <Par rotulo="Total" valor={formatarEuros(fatura.total)} destaque />
        ) : null}
        {fatura.data ? <Par rotulo="Data" valor={formatarData(fatura.data)} /> : null}
        {fatura.taxaDominante != null ? (
          <Par
            rotulo="IVA"
            valor={
              fatura.taxaDominante === 0
                ? 'Isento'
                : `${fatura.taxaDominante}%${fatura.variasTaxas ? ' (a maior)' : ''}`
            }
          />
        ) : null}
        {fatura.nifEmitente ? (
          <Par
            rotulo="Fornecedor"
            valor={fornecedor ? fornecedor.nome : `NIF ${fatura.nifEmitente}`}
          />
        ) : null}
      </dl>

      {fatura.anulado ? (
        <Aviso tom="erro" className="mt-2">
          Este documento está <strong>anulado</strong>. Não deve ser lançado como
          despesa.
        </Aviso>
      ) : null}

      {fatura.variasTaxas ? (
        <Aviso tom="atencao" className="mt-2">
          A fatura tem valores em mais do que uma taxa de IVA. A aplicação guarda
          uma taxa só, por isso a decomposição vai ficar aproximada — o total é
          que está certo.
        </Aviso>
      ) : null}

      {fatura.nifEmitente && !fornecedor ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Não há nenhum fornecedor com o NIF {fatura.nifEmitente}. Crie-o para
          que da próxima vez seja reconhecido sozinho.
        </p>
      ) : null}

      <div className="mt-3">
        {aplicada ? (
          <p className="text-xs text-success">
            Campos preenchidos. Confirme antes de guardar.
          </p>
        ) : (
          <Botao variante="contorno" tamanho="pequeno" onClick={aoPreencher}>
            Preencher com estes valores
          </Botao>
        )}
      </div>
    </div>
  )
}

function Par({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string
  valor: string
  destaque?: boolean
}) {
  return (
    <div className="flex justify-between gap-2 sm:justify-start">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className={destaque ? 'tabular font-semibold' : 'tabular'}>{valor}</dd>
    </div>
  )
}

/** Desenha a imagem numa tela à largura pedida e procura um QR code. */
function descodificar(bitmap: ImageBitmap, larguraAlvo: number) {
  const escala = Math.min(1, larguraAlvo / bitmap.width)
  const largura = Math.max(1, Math.round(bitmap.width * escala))
  const altura = Math.max(1, Math.round(bitmap.height * escala))

  const tela = document.createElement('canvas')
  tela.width = largura
  tela.height = altura

  const contexto = tela.getContext('2d', { willReadFrequently: true })
  if (!contexto) return null

  contexto.drawImage(bitmap, 0, 0, largura, altura)
  const pixeis = contexto.getImageData(0, 0, largura, altura)

  return jsQR(pixeis.data, largura, altura, {
    inversionAttempts: 'attemptBoth',
  })?.data
}
