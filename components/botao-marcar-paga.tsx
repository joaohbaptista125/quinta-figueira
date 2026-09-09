'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { marcarDespesaPaga } from '@/lib/accoes/financeiro'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'

function Submeter() {
  const { pending } = useFormStatus()
  return (
    <Botao type="submit" variante="contorno" tamanho="pequeno" disabled={pending}>
      {pending ? '…' : 'Marcar paga'}
    </Botao>
  )
}

export function BotaoMarcarPaga({ id }: { id: string }) {
  const [resultado, executar] = useActionState(marcarDespesaPaga, SEM_RESULTADO)

  return (
    <form action={executar}>
      <input type="hidden" name="id" value={id} />
      {resultado.mensagem && !resultado.ok ? (
        <span className="text-xs text-destructive">{resultado.mensagem}</span>
      ) : (
        <Submeter />
      )}
    </form>
  )
}
