import Link from 'next/link'
import {
  Cartao,
  SemRegistos,
} from '@/components/ui/superficie'
import { classesBotao } from '@/components/ui/botao'
import { CartaoEvento, type EventoCompleto } from '@/components/cartao-evento'
import { ListaEventos, type Evento } from '@/components/lista-eventos'
import { formatarDiaPorExtenso, hoje } from '@/lib/formatos'

/** A semana em lista: um bloco por dia, dos sete, mesmo os vazios. */
export function VistaSemana({
  dias,
  eventos,
  podeEditar,
}: {
  dias: string[]
  eventos: Evento[]
  podeEditar: boolean
}) {
  const hojeIso = hoje()

  return (
    <div className="space-y-3">
      {dias.map((dia) => {
        const doDia = eventos.filter((evento) => evento.data === dia)

        return (
          <Cartao key={dia} className={doDia.length === 0 ? 'opacity-70' : undefined}>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
              <Link
                href={`/agenda?vista=dia&dia=${dia}`}
                className="text-sm font-semibold underline-offset-4 hover:underline"
              >
                {formatarDiaPorExtenso(dia)}
                {dia === hojeIso ? (
                  <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    Hoje
                  </span>
                ) : null}
              </Link>
              {podeEditar && doDia.length === 0 ? (
                <Link
                  href={`/agenda/novo?dia=${dia}`}
                  className="text-xs text-primary underline-offset-4 hover:underline"
                >
                  Marcar
                </Link>
              ) : null}
            </div>

            {doDia.length > 0 ? (
              <ListaEventos eventos={doDia} />
            ) : (
              <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground sm:px-5">
                Nada marcado.
              </p>
            )}
          </Cartao>
        )
      })}
    </div>
  )
}

/** O quadro do dia: aluno e cavalo, hora a hora. */
export function VistaDia({
  dia,
  eventos,
  podeEditar,
}: {
  dia: string
  eventos: EventoCompleto[]
  podeEditar: boolean
}) {
  if (eventos.length === 0) {
    return (
      <Cartao>
        <SemRegistos
          titulo="Nada marcado para este dia"
          descricao={
            podeEditar
              ? 'Marque uma aula, um treino de Horseball ou uma competição.'
              : 'Quando houver alguma coisa para si, aparece aqui.'
          }
          accao={
            podeEditar ? (
              <Link href={`/agenda/novo?dia=${dia}`} className={classesBotao()}>
                Marcar
              </Link>
            ) : null
          }
        />
      </Cartao>
    )
  }

  return (
    <ol className="space-y-3">
      {eventos.map((evento) => (
        <li key={evento.id}>
          <CartaoEvento evento={evento} podeEditar={podeEditar} />
        </li>
      ))}
    </ol>
  )
}
