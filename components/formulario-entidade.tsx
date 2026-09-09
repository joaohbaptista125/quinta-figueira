'use client'

import * as React from 'react'
import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Botao, classesBotao } from '@/components/ui/botao'
import { Aviso } from '@/components/ui/superficie'
import type { ResultadoAccao } from '@/lib/accoes/resultado'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'

function BotoesSubmeter({
  rotuloGuardar,
  permitirCriarOutro,
}: {
  rotuloGuardar: string
  permitirCriarOutro: boolean
}) {
  const { pending } = useFormStatus()

  return (
    <>
      <Botao type="submit" name="continuar" value="nao" disabled={pending}>
        {pending ? 'A guardar…' : rotuloGuardar}
      </Botao>
      {permitirCriarOutro ? (
        <Botao
          type="submit"
          name="continuar"
          value="sim"
          variante="contorno"
          disabled={pending}
        >
          Guardar e criar outro
        </Botao>
      ) : null}
    </>
  )
}

/**
 * Formulário de criação/edição.
 *
 * O botão "Guardar e criar outro" existe para a fase de digitação inicial: são
 * ~60 cavalos e ~80 pessoas a introduzir de seguida, e voltar à listagem entre
 * cada registo custa demasiados cliques. Nesse caso o formulário limpa-se e o
 * foco volta ao primeiro campo.
 */
export function FormularioEntidade({
  accao,
  id,
  children,
  hrefCancelar,
  rotuloGuardar = 'Guardar',
  permitirCriarOutro = false,
  extra,
}: {
  accao: (
    anterior: ResultadoAccao,
    dados: FormData,
  ) => Promise<ResultadoAccao>
  id?: string
  children: React.ReactNode
  hrefCancelar: string
  rotuloGuardar?: string
  permitirCriarOutro?: boolean
  extra?: React.ReactNode
}) {
  const [resultado, executar] = useActionState(accao, SEM_RESULTADO)
  const [chave, setChave] = React.useState(0)
  const referenciaFormulario = React.useRef<HTMLFormElement>(null)

  // Depois de "guardar e criar outro", limpa o formulário e devolve o foco ao
  // primeiro campo para se poder continuar a escrever sem tocar no rato.
  React.useEffect(() => {
    if (resultado.ok && resultado.mensagem) {
      setChave((anterior) => anterior + 1)
      const primeiro =
        referenciaFormulario.current?.querySelector<HTMLElement>(
          'input:not([type=hidden]), select, textarea',
        )
      primeiro?.focus()
    }
  }, [resultado])

  return (
    <form ref={referenciaFormulario} action={executar} className="space-y-5">
      {id ? <input type="hidden" name="id" value={id} /> : null}

      {resultado.ok && resultado.mensagem ? (
        <Aviso tom="sucesso">{resultado.mensagem}</Aviso>
      ) : null}
      {!resultado.ok && resultado.mensagem ? (
        <Aviso tom="erro">{resultado.mensagem}</Aviso>
      ) : null}

      <div key={chave} className="space-y-5">
        {children}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <BotoesSubmeter
          rotuloGuardar={rotuloGuardar}
          permitirCriarOutro={permitirCriarOutro && !id}
        />
        <Link
          href={hrefCancelar}
          className={classesBotao('fantasma', 'normal', 'ml-auto')}
        >
          Cancelar
        </Link>
        {extra}
      </div>
    </form>
  )
}

/** Grelha responsiva para os campos de um formulário. */
export function GrelhaCampos({
  children,
  colunas = 2,
}: {
  children: React.ReactNode
  colunas?: 1 | 2 | 3
}) {
  const classe =
    colunas === 1
      ? 'grid-cols-1'
      : colunas === 3
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2'
  return <div className={`grid gap-4 ${classe}`}>{children}</div>
}
