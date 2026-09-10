'use client'

import { useActionState } from 'react'
import { cancelarEvento } from '@/lib/accoes/eventos'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { Entrada } from '@/components/ui/campos'
import { Aviso } from '@/components/ui/superficie'

export function CancelarEvento({
  id,
  cancelado,
}: {
  id: string
  cancelado: boolean
}) {
  const [resultado, executar] = useActionState(cancelarEvento, SEM_RESULTADO)

  return (
    <form action={executar} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="cancelar" value={cancelado ? 'false' : 'on'} />

      {cancelado ? (
        <>
          <Botao type="submit" variante="contorno">
            Reabrir evento
          </Botao>
          <p className="text-xs text-muted-foreground">
            Reabrir pode falhar se algum cavalo entretanto tiver ficado ocupado
            à mesma hora.
          </p>
        </>
      ) : (
        <>
          <Entrada
            name="motivo"
            placeholder="Motivo (opcional) — ex.: chuva"
            aria-label="Motivo do cancelamento"
          />
          <Botao type="submit" variante="destrutivo">
            Cancelar evento
          </Botao>
          <p className="text-xs text-muted-foreground">
            O evento fica visível e marcado como cancelado, os cavalos ficam
            livres, e quem subscreveu o calendário vê-o desaparecer.
          </p>
        </>
      )}

      {resultado.mensagem ? (
        <Aviso tom={resultado.ok ? 'sucesso' : 'erro'}>{resultado.mensagem}</Aviso>
      ) : null}
    </form>
  )
}
