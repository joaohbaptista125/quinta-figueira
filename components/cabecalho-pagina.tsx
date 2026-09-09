import * as React from 'react'

export function CabecalhoPagina({
  titulo,
  descricao,
  accoes,
}: {
  titulo: string
  descricao?: React.ReactNode
  accoes?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {titulo}
        </h1>
        {descricao ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p>
        ) : null}
      </div>
      {accoes ? <div className="flex gap-2">{accoes}</div> : null}
    </div>
  )
}
