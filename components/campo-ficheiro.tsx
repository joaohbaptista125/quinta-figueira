'use client'

import { useRef, useState } from 'react'
import { criarClienteBrowser } from '@/lib/supabase/cliente'
import { Botao } from '@/components/ui/botao'
import { Entrada } from '@/components/ui/campos'
import { cn } from '@/lib/utils'

type Estado =
  | { fase: 'vazio' }
  | { fase: 'a-enviar'; nome: string }
  | { fase: 'enviado'; nome: string }
  | { fase: 'erro'; mensagem: string }

/**
 * Carrega um ficheiro directamente do browser para o Supabase Storage e mete o
 * caminho resultante num campo escondido, que é o que o formulário envia.
 *
 * O ficheiro NÃO passa pelo servidor da aplicação de propósito. Um Server
 * Action do Next aceita 1 MB de corpo por omissão e a Vercel corta pedidos
 * acima de 4,5 MB — uma fotografia de telemóvel não cabe em nenhum dos dois.
 * A ligar directamente ao Storage valem os limites do bucket (10 MB nas fotos,
 * 20 MB nos documentos) e o ficheiro viaja uma vez em vez de duas.
 *
 * Um ficheiro carregado num formulário que depois é abandonado fica no bucket
 * sem ninguém a apontar-lhe. Não faz mal a ninguém e é barato; limpar isso é
 * trabalho para quando houver muitos.
 */
export function CampoFicheiro({
  name,
  bucket,
  prefixo = '',
  accept,
  valorInicial,
  tamanhoMaximoMB,
}: {
  /** Nome do campo escondido que leva o caminho para o Server Action. */
  name: string
  bucket: 'cavalos' | 'documentos'
  /** Pasta dentro do bucket, ex. "despesas/2026/". */
  prefixo?: string
  accept: string
  valorInicial?: string | null
  tamanhoMaximoMB: number
}) {
  const [estado, setEstado] = useState<Estado>({ fase: 'vazio' })
  const [caminho, setCaminho] = useState(valorInicial ?? '')
  const referencia = useRef<HTMLInputElement>(null)

  async function aoEscolher(ficheiro: File | undefined) {
    if (!ficheiro) return

    if (ficheiro.size > tamanhoMaximoMB * 1024 * 1024) {
      setEstado({
        fase: 'erro',
        mensagem: `O ficheiro tem ${(ficheiro.size / 1024 / 1024).toFixed(1)} MB e o limite é ${tamanhoMaximoMB} MB.`,
      })
      return
    }

    setEstado({ fase: 'a-enviar', nome: ficheiro.name })

    const extensao = ficheiro.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const destino = `${prefixo}${crypto.randomUUID()}.${extensao}`

    const supabase = criarClienteBrowser()
    const { error } = await supabase.storage
      .from(bucket)
      .upload(destino, ficheiro, { contentType: ficheiro.type, upsert: false })

    if (error) {
      setEstado({
        fase: 'erro',
        mensagem: `Não foi possível carregar: ${error.message}`,
      })
      return
    }

    setCaminho(destino)
    setEstado({ fase: 'enviado', nome: ficheiro.name })
  }

  function limpar() {
    setCaminho('')
    setEstado({ fase: 'vazio' })
    if (referencia.current) referencia.current.value = ''
  }

  return (
    <div className="space-y-1.5">
      {/* É isto que o formulário envia — o caminho, não o ficheiro. */}
      <input type="hidden" name={name} value={caminho} />

      <Entrada
        ref={referencia}
        type="file"
        accept={accept}
        disabled={estado.fase === 'a-enviar'}
        onChange={(evento) => aoEscolher(evento.target.files?.[0])}
        className="h-auto py-1.5 file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
      />

      {estado.fase === 'a-enviar' ? (
        <p className="text-xs text-muted-foreground">A carregar {estado.nome}…</p>
      ) : null}

      {estado.fase === 'enviado' ? (
        <p className="flex items-center gap-2 text-xs text-success">
          <span>{estado.nome} carregado.</span>
          <Botao
            variante="fantasma"
            tamanho="pequeno"
            className="h-auto px-1 py-0 text-xs underline"
            onClick={limpar}
          >
            remover
          </Botao>
        </p>
      ) : null}

      {estado.fase === 'erro' ? (
        <p className="text-xs text-destructive">{estado.mensagem}</p>
      ) : null}

      {estado.fase === 'vazio' && caminho ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Já tem um ficheiro guardado.</span>
          <Botao
            variante="fantasma"
            tamanho="pequeno"
            className={cn('h-auto px-1 py-0 text-xs underline')}
            onClick={limpar}
          >
            substituir
          </Botao>
        </p>
      ) : null}
    </div>
  )
}
