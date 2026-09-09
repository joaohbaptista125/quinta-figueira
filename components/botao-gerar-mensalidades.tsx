'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { gerarMensalidades } from '@/lib/accoes/financeiro'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'

function Submeter() {
  const { pending } = useFormStatus()
  return (
    <Botao type="submit" variante="contorno" disabled={pending}>
      {pending ? 'A gerar…' : 'Gerar mensalidades'}
    </Botao>
  )
}

export function BotaoGerarMensalidades({ periodo }: { periodo: string }) {
  const [resultado, executar] = useActionState(gerarMensalidades, SEM_RESULTADO)

  return (
    <form action={executar} className="flex items-center gap-2">
      <input type="hidden" name="periodo" value={periodo} />
      <Submeter />
      {resultado.mensagem ? (
        <span
          className={
            resultado.ok
              ? 'text-xs text-muted-foreground'
              : 'text-xs text-destructive'
          }
        >
          {resultado.mensagem}
        </span>
      ) : null}
    </form>
  )
}
