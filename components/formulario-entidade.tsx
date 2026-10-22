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
  const referenciaAviso = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!resultado.mensagem) return

    if (resultado.ok) {
      // Depois de «guardar e criar outro»: limpa o formulário e devolve o foco
      // ao primeiro campo, para se continuar a escrever sem tocar no rato.
      setChave((anterior) => anterior + 1)
      // Os `file` ficam de fora: o de importar contactos está escondido e
      // aparece antes do nome, e o foco ia parar a um campo que não se vê.
      const primeiro =
        referenciaFormulario.current?.querySelector<HTMLElement>(
          'input:not([type=hidden]):not([type=file]), select, textarea',
        )
      primeiro?.focus()
      return
    }

    /*
     * O erro aparece no topo do formulário, e o botão de guardar está vinte
     * campos abaixo: quem carregava nele via a página ficar exactamente na
     * mesma e concluía que não tinha acontecido nada. Trazer a mensagem ao
     * ecrã é o que transforma isso num «falta-te aqui uma coisa».
     */
    referenciaAviso.current?.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    })
  }, [resultado])

  return (
    <form ref={referenciaFormulario} action={executar} className="space-y-5">
      {id ? <input type="hidden" name="id" value={id} /> : null}

      {/* Só existe quando há mensagem: um `div` vazio permanente acrescentava
          um espaço a mais no topo de todos os formulários. */}
      {resultado.mensagem ? (
        <div ref={referenciaAviso}>
          <Aviso tom={resultado.ok ? 'sucesso' : 'erro'}>
            {resultado.mensagem}
          </Aviso>
        </div>
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

/**
 * Secção de um formulário, com um título.
 *
 * Os formulários mais longos — pessoa e cavalo — eram uma parede de vinte
 * campos sem nenhuma divisão, e quem os preenche sessenta vezes seguidas
 * perde o fio. Dividi-los em blocos com nome dá pontos de referência e mostra
 * de relance o que falta.
 */
export function SeccaoCampos({
  titulo,
  descricao,
  children,
}: {
  titulo: string
  descricao?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="border-b border-border pb-1.5">
        <h2 className="text-sm font-semibold tracking-tight">{titulo}</h2>
        {descricao ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}
