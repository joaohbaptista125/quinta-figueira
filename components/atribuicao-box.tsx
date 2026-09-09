'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { atribuirBox } from '@/lib/accoes/cavalos'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { Selector } from '@/components/ui/campos'
import { Aviso } from '@/components/ui/superficie'

type Box = { id: string; identificacao: string; zona: string | null }

function Submeter() {
  const { pending } = useFormStatus()
  return (
    <Botao type="submit" variante="contorno" disabled={pending}>
      {pending ? 'A guardar…' : 'Guardar'}
    </Botao>
  )
}

export function AtribuicaoBox({
  cavaloId,
  boxActual,
  boxesLivres,
}: {
  cavaloId: string
  boxActual: Box | null
  boxesLivres: Box[]
}) {
  const [resultado, executar] = useActionState(atribuirBox, SEM_RESULTADO)
  const opcoes = boxActual ? [boxActual, ...boxesLivres] : boxesLivres

  return (
    <form action={executar} className="space-y-2">
      <input type="hidden" name="cavalo_id" value={cavaloId} />
      <div className="flex gap-2">
        <Selector
          name="box_id"
          defaultValue={boxActual?.id ?? ''}
          aria-label="Box atribuída"
        >
          <option value="">— Sem box —</option>
          {opcoes.map((box) => (
            <option key={box.id} value={box.id}>
              {box.identificacao}
              {box.zona ? ` · ${box.zona}` : ''}
            </option>
          ))}
        </Selector>
        <Submeter />
      </div>
      {resultado.mensagem ? (
        <Aviso tom={resultado.ok ? 'sucesso' : 'erro'}>{resultado.mensagem}</Aviso>
      ) : null}
    </form>
  )
}
