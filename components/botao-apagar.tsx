'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Botao } from '@/components/ui/botao'
import { Aviso } from '@/components/ui/superficie'
import type { ResultadoAccao } from '@/lib/accoes/resultado'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'

function Submeter({ rotulo, confirmacao }: { rotulo: string; confirmacao: string }) {
  const { pending } = useFormStatus()
  return (
    <Botao
      type="submit"
      variante="destrutivo"
      disabled={pending}
      onClick={(evento) => {
        if (!window.confirm(confirmacao)) evento.preventDefault()
      }}
    >
      {pending ? 'A apagar…' : rotulo}
    </Botao>
  )
}

export function BotaoApagar({
  accao,
  id,
  rotulo = 'Apagar',
  confirmacao = 'Tem a certeza? Esta operação não pode ser desfeita.',
}: {
  accao: (anterior: ResultadoAccao, dados: FormData) => Promise<ResultadoAccao>
  id: string
  rotulo?: string
  confirmacao?: string
}) {
  const [resultado, executar] = useActionState(accao, SEM_RESULTADO)

  return (
    <div className="space-y-2">
      <form action={executar}>
        <input type="hidden" name="id" value={id} />
        <Submeter rotulo={rotulo} confirmacao={confirmacao} />
      </form>
      {resultado.mensagem ? <Aviso tom="erro">{resultado.mensagem}</Aviso> : null}
    </div>
  )
}
