'use client'

import { useActionState } from 'react'
import { sair } from '@/lib/accoes/autenticacao'
import { Botao } from '@/components/ui/botao'
import { cn } from '@/lib/utils'

export function MenuUtilizador({
  nome,
  perfil,
  compacto,
}: {
  nome: string
  perfil: string | null
  compacto?: boolean
}) {
  const [, terminarSessao] = useActionState(async () => {
    await sair()
  }, undefined)

  return (
    <form
      action={terminarSessao}
      className={cn(
        'flex items-center gap-2',
        compacto ? 'justify-end' : 'justify-between',
      )}
    >
      {!compacto ? (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{nome}</p>
          {perfil ? (
            <p className="truncate text-xs text-muted-foreground">{perfil}</p>
          ) : null}
        </div>
      ) : null}
      <Botao type="submit" variante="fantasma" tamanho="pequeno">
        Sair
      </Botao>
    </form>
  )
}
