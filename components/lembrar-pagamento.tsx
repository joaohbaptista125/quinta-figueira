'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { BellRing } from 'lucide-react'
import { lembrarPagamento } from '@/lib/accoes/financeiro'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { Aviso } from '@/components/ui/superficie'

/**
 * Lembrar um cliente do que tem por pagar — à mão, e só quando a gestão
 * entender.
 *
 * Deliberadamente não é automático: há quem pague sempre a dia 8 e esteja de
 * férias, e há quem precise de um toque. Um aviso a toda a gente que passa do
 * vencimento era a maneira mais rápida de estes avisos passarem a ser
 * ignorados.
 */
export function LembrarPagamento({
  pessoaId,
  nome,
}: {
  pessoaId: string
  nome: string
}) {
  const [resultado, executar] = useActionState(lembrarPagamento, SEM_RESULTADO)

  return (
    <div className="space-y-2">
      <form action={executar}>
        <input type="hidden" name="pessoa" value={pessoaId} />
        <Submeter nome={nome.split(' ')[0]} />
      </form>

      {resultado.mensagem ? (
        <Aviso tom={resultado.ok ? 'sucesso' : 'atencao'}>
          {resultado.mensagem}
        </Aviso>
      ) : null}
    </div>
  )
}

function Submeter({ nome }: { nome: string }) {
  const { pending } = useFormStatus()
  return (
    <Botao
      type="submit"
      variante="contorno"
      disabled={pending}
      title={`Manda uma notificação a ${nome} com o total em falta`}
    >
      <BellRing className="size-4" aria-hidden />
      {pending ? 'A avisar…' : 'Lembrar'}
    </Botao>
  )
}
