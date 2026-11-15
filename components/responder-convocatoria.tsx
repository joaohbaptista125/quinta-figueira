'use client'

import { useActionState, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Check, X } from 'lucide-react'
import { responderConvocatoria } from '@/lib/accoes/eventos'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { Campo, Entrada } from '@/components/ui/campos'
import { Aviso, Distintivo } from '@/components/ui/superficie'
import { formatarDataHora } from '@/lib/formatos'
import type { ConfirmacaoParticipante } from '@/lib/tipos-bd'

/**
 * «Vou» / «Não vou», do lado de quem foi convocado.
 *
 * Isto **não marca presença**: diz o que a pessoa tenciona fazer, para quem
 * dá a aula saber a tempo. Quem escreve a presença é a equipa, depois, e é
 * por isso que os dois nunca aparecem como a mesma coisa no ecrã.
 *
 * Responder não desmarca nada nem liberta o cavalo — quem decide se a aula se
 * faz, e com que par, é quem a dá. Mudar de ideias é carregar no outro botão.
 */
export function ResponderConvocatoria({
  eventoId,
  confirmacao,
  confirmadoEm,
  motivo,
  passou,
}: {
  eventoId: string
  confirmacao: ConfirmacaoParticipante
  confirmadoEm: string | null
  motivo: string | null
  /** Depois do evento já não há nada a responder. */
  passou: boolean
}) {
  const [aRecusar, setARecusar] = useState(false)
  const [resultado, responder] = useActionState(
    responderConvocatoria,
    SEM_RESULTADO,
  )
  const prefixo = useId()

  if (passou) {
    return confirmacao === 'sem_resposta' ? null : (
      <p className="text-sm text-muted-foreground">
        Tinha respondido que{' '}
        {confirmacao === 'vai' ? 'ia' : 'não ia'}
        {motivo ? ` — ${motivo}` : ''}.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {confirmacao === 'sem_resposta' ? (
        <p className="text-sm text-muted-foreground">
          Foi convocado. Diga se conta estar presente — quem dá a sessão precisa
          de saber a tempo.
        </p>
      ) : (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Distintivo cor={confirmacao === 'vai' ? 'sucesso' : 'aviso'}>
            {confirmacao === 'vai' ? 'Disse que vai' : 'Disse que não vai'}
          </Distintivo>
          {confirmadoEm ? (
            <span className="text-muted-foreground">
              {formatarDataHora(confirmadoEm)}
            </span>
          ) : null}
          {motivo ? (
            <span className="text-muted-foreground">· {motivo}</span>
          ) : null}
        </p>
      )}

      {aRecusar ? (
        <form action={responder} className="space-y-3">
          <input type="hidden" name="evento_id" value={eventoId} />
          <input type="hidden" name="confirmacao" value="nao_vai" />

          <Campo
            etiqueta="Porquê"
            htmlFor={`${prefixo}-motivo`}
            ajuda="Opcional, mas ajuda quem está a organizar. Ex.: «estou fora nessa semana»."
          >
            <Entrada
              id={`${prefixo}-motivo`}
              name="motivo"
              maxLength={200}
              autoFocus
              autoComplete="off"
              defaultValue={motivo ?? ''}
            />
          </Campo>

          <div className="flex flex-wrap gap-2">
            <BotaoSubmeter rotulo="Avisar que não vou" variante="destrutivo" />
            <Botao variante="fantasma" onClick={() => setARecusar(false)}>
              Voltar atrás
            </Botao>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <form action={responder}>
            <input type="hidden" name="evento_id" value={eventoId} />
            <input type="hidden" name="confirmacao" value="vai" />
            <BotaoSubmeter
              rotulo={confirmacao === 'vai' ? 'Continuo a ir' : 'Vou'}
              icone="sim"
            />
          </form>

          <Botao variante="contorno" onClick={() => setARecusar(true)}>
            <X className="size-4" aria-hidden />
            {confirmacao === 'nao_vai' ? 'Mudar o motivo' : 'Não vou'}
          </Botao>
        </div>
      )}

      {resultado.mensagem ? (
        <Aviso tom={resultado.ok ? 'sucesso' : 'erro'}>{resultado.mensagem}</Aviso>
      ) : null}
    </div>
  )
}

function BotaoSubmeter({
  rotulo,
  variante = 'primario',
  icone,
}: {
  rotulo: string
  variante?: 'primario' | 'destrutivo'
  icone?: 'sim'
}) {
  const { pending } = useFormStatus()
  return (
    <Botao type="submit" variante={variante} disabled={pending}>
      {icone === 'sim' ? <Check className="size-4" aria-hidden /> : null}
      {pending ? 'Um instante…' : rotulo}
    </Botao>
  )
}
