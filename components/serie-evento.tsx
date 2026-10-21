'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { CalendarX, CopyPlus } from 'lucide-react'
import {
  cancelarSeguintesDaSerie,
  copiarConvocatoriaDaSerie,
} from '@/lib/accoes/eventos'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { Aviso } from '@/components/ui/superficie'
import { formatarDiaCurto } from '@/lib/formatos'

export type MarcacaoDaSerie = {
  id: string
  data: string
  cancelado: boolean
}

/**
 * A série vista de dentro de uma marcação.
 *
 * Uma série não é um objecto com vida própria — é uma etiqueta. Por isso esta
 * caixa não a edita: diz em que ponto da repetição se está, mostra as
 * seguintes, e oferece as duas únicas coisas que valem a pena fazer de uma vez
 * só. Mudar a hora, o local ou um convocado é de cada marcação, porque é assim
 * que acontece na vida — a aula de 4 de Novembro muda de picadeiro, as outras
 * não.
 */
export function SerieEvento({
  eventoId,
  marcacoes,
  podeEditar,
}: {
  eventoId: string
  marcacoes: MarcacaoDaSerie[]
  podeEditar: boolean
}) {
  const posicao = marcacoes.findIndex((marcacao) => marcacao.id === eventoId) + 1
  // Só as que vêm depois desta, e que ainda estão de pé: copiar para trás não
  // faz sentido, e cancelar o que já está cancelado também não.
  const porVir = marcacoes.slice(posicao).filter((marcacao) => !marcacao.cancelado)

  return (
    <div className="space-y-3">
      <p className="text-sm">
        Marcação <strong>{posicao}</strong> de {marcacoes.length}, de semana a
        semana.
      </p>

      <ul className="flex flex-wrap gap-1.5 text-xs">
        {marcacoes.map((marcacao) => (
          <li key={marcacao.id}>
            <Link
              href={`/agenda/${marcacao.id}`}
              className={
                marcacao.id === eventoId
                  ? 'inline-flex rounded-md border border-primary bg-primary/10 px-2 py-1 font-medium'
                  : marcacao.cancelado
                    ? 'inline-flex rounded-md border border-border px-2 py-1 text-muted-foreground line-through hover:bg-accent'
                    : 'inline-flex rounded-md border border-border px-2 py-1 hover:bg-accent'
              }
            >
              {formatarDiaCurto(marcacao.data)}
            </Link>
          </li>
        ))}
      </ul>

      {podeEditar && porVir.length > 0 ? (
        <div className="space-y-3 border-t border-border pt-3">
          <CopiarConvocatoria eventoId={eventoId} quantas={porVir.length} />
          <CancelarSeguintes eventoId={eventoId} quantas={porVir.length} />
        </div>
      ) : null}
    </div>
  )
}

/**
 * O passo que falta à repetição: marcar oito terças de uma vez não poupa nada
 * se depois for preciso convocar os mesmos quatro alunos oito vezes.
 */
function CopiarConvocatoria({
  eventoId,
  quantas,
}: {
  eventoId: string
  quantas: number
}) {
  const [resultado, executar, pendente] = useActionState(
    copiarConvocatoriaDaSerie,
    SEM_RESULTADO,
  )

  return (
    <form action={executar} className="space-y-2">
      <input type="hidden" name="evento_id" value={eventoId} />
      <Botao type="submit" variante="contorno" disabled={pendente}>
        <CopyPlus className="size-4" aria-hidden />
        {pendente ? 'A copiar…' : 'Copiar convocatória para as seguintes'}
      </Botao>
      <p className="text-xs text-muted-foreground">
        Leva estes convocados, com os mesmos cavalos, às{' '}
        {quantas === 1 ? 'marcação seguinte' : `${quantas} marcações seguintes`}.
        Quem já lá estiver fica como está.
      </p>
      {resultado.mensagem ? (
        <Aviso tom={resultado.ok ? 'sucesso' : 'erro'}>{resultado.mensagem}</Aviso>
      ) : null}
    </form>
  )
}

/** Para quando a série acaba a meio — o aluno desistiu, o período fechou. */
function CancelarSeguintes({
  eventoId,
  quantas,
}: {
  eventoId: string
  quantas: number
}) {
  const [resultado, executar, pendente] = useActionState(
    cancelarSeguintesDaSerie,
    SEM_RESULTADO,
  )

  return (
    <form
      action={executar}
      className="space-y-2"
      onSubmit={(evento) => {
        if (
          !window.confirm(
            `Cancelar as ${quantas} marcações seguintes desta série? Esta fica como está.`,
          )
        ) {
          evento.preventDefault()
        }
      }}
    >
      <input type="hidden" name="evento_id" value={eventoId} />
      <Botao type="submit" variante="contorno" disabled={pendente}>
        <CalendarX className="size-4" aria-hidden />
        {pendente ? 'A cancelar…' : 'Cancelar as seguintes'}
      </Botao>
      {resultado.mensagem ? (
        <Aviso tom={resultado.ok ? 'sucesso' : 'erro'}>{resultado.mensagem}</Aviso>
      ) : null}
    </form>
  )
}
