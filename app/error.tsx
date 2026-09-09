'use client'

import { useEffect } from 'react'
import { Botao } from '@/components/ui/botao'

export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold">Alguma coisa correu mal</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Tente de novo. Se voltar a acontecer, tome nota do que estava a fazer e
        avise quem gere a aplicação.
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">
          Referência: {error.digest}
        </p>
      ) : null}
      <Botao onClick={reset} variante="contorno" className="mt-2">
        Tentar de novo
      </Botao>
    </main>
  )
}
