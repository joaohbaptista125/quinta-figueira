import * as React from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export function CabecalhoPagina({
  titulo,
  descricao,
  accoes,
  voltar,
}: {
  titulo: string
  descricao?: React.ReactNode
  accoes?: React.ReactNode
  /**
   * Para onde se volta a partir desta página.
   *
   * No telemóvel não há barra lateral e a barra de baixo só tem as secções
   * principais, por isso de uma ficha não havia caminho de regresso à
   * listagem sem ser o botão do sistema. Aparece também no computador, que é
   * onde se percebe em que secção se está.
   */
  voltar?: { href: string; rotulo: string }
}) {
  return (
    <div className="mb-5">
      {voltar ? (
        <Link
          href={voltar.href}
          className="mb-1.5 -ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {voltar.rotulo}
        </Link>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {titulo}
          </h1>
          {descricao ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p>
          ) : null}
        </div>
        {accoes ? <div className="flex flex-wrap gap-2">{accoes}</div> : null}
      </div>
    </div>
  )
}
