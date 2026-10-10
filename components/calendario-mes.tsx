import Link from 'next/link'
import { cn } from '@/lib/utils'
import { COR_POR_TIPO, type Evento } from '@/components/lista-eventos'
import { ROTULOS_TIPO_EVENTO_CURTO } from '@/lib/rotulos'
import {
  DIAS_DA_SEMANA_CURTOS,
  formatarHora,
  gradeDoMes,
  hoje,
  mesmoMes,
} from '@/lib/formatos'

/*
 * O mês inteiro de uma vez.
 *
 * A agenda abria no quadro de um dia, e um dia não diz nada sobre a semana a
 * seguir: para saber se a sexta estava cheia era preciso lá ir. Esta grelha
 * responde à pergunta que se faz ao planear — onde há espaço, onde há
 * competição — e cada dia leva ao quadro desse dia.
 *
 * No telemóvel uma grelha de sete colunas não tem largura para texto, por isso
 * abaixo de `sm` cada evento é um ponto da cor do tipo. A contagem fica
 * escrita ao lado do número do dia, que é o que falta saber de relance.
 */

const CORES_PONTO: Record<string, string> = {
  primario: 'bg-primary',
  informacao: 'bg-info',
  aviso: 'bg-warning',
}

/** Quantos eventos cabem escritos numa célula antes do «mais N». */
const CABEM_NA_CELULA = 3

export function CalendarioMes({
  periodo,
  eventos,
}: {
  /** Qualquer dia do mês a mostrar. */
  periodo: string
  eventos: Evento[]
}) {
  const dias = gradeDoMes(periodo)
  const hojeIso = hoje()

  const porDia = new Map<string, Evento[]>()
  for (const evento of eventos) {
    const lista = porDia.get(evento.data) ?? []
    lista.push(evento)
    porDia.set(evento.data, lista)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/60">
        {DIAS_DA_SEMANA_CURTOS.map((nome) => (
          <div
            key={nome}
            className="px-1 py-2 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs"
          >
            {/* As três letras cabem mesmo a 390 px, e as iniciais sozinhas não
                serviam: S é segunda, sexta e sábado. */}
            {nome}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {dias.map((dia) => {
          const doDia = porDia.get(dia) ?? []
          const esteMes = mesmoMes(dia, periodo)
          const eHoje = dia === hojeIso

          return (
            <Link
              key={dia}
              href={`/agenda?vista=dia&dia=${dia}`}
              aria-current={eHoje ? 'date' : undefined}
              aria-label={`${Number(dia.slice(8))} — ${
                doDia.length === 1 ? '1 marcação' : `${doDia.length} marcações`
              }`}
              className={cn(
                'relative flex min-h-16 flex-col gap-1 border-b border-r border-border p-1 transition-colors sm:min-h-28 sm:p-1.5',
                'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                // A última coluna e a última linha não precisam de risco.
                '[&:nth-child(7n)]:border-r-0',
                esteMes ? '' : 'bg-muted/30',
              )}
            >
              <span className="flex items-center gap-1">
                <span
                  className={cn(
                    'tabular inline-flex size-6 items-center justify-center rounded-full text-xs',
                    eHoje && 'bg-primary font-semibold text-primary-foreground',
                    !eHoje && esteMes && 'font-medium',
                    !esteMes && 'text-muted-foreground',
                  )}
                >
                  {Number(dia.slice(8))}
                </span>
                {doDia.length > 0 ? (
                  <span className="text-[0.65rem] text-muted-foreground sm:hidden">
                    {doDia.length}
                  </span>
                ) : null}
              </span>

              {/* Telemóvel: um ponto por evento. */}
              {doDia.length > 0 ? (
                <span className="flex flex-wrap gap-0.5 sm:hidden">
                  {doDia.slice(0, 4).map((evento) => (
                    <span
                      key={evento.id}
                      className={cn(
                        'block size-1.5 rounded-full',
                        CORES_PONTO[COR_POR_TIPO[evento.tipo]],
                        evento.cancelado && 'opacity-40',
                      )}
                    />
                  ))}
                </span>
              ) : null}

              {/* Ecrã grande: a hora e o que é. */}
              <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                {doDia.slice(0, CABEM_NA_CELULA).map((evento) => (
                  <span
                    key={evento.id}
                    className={cn(
                      'flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-[0.7rem] leading-tight',
                      evento.cancelado
                        ? 'text-muted-foreground line-through'
                        : 'bg-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        CORES_PONTO[COR_POR_TIPO[evento.tipo]],
                      )}
                    />
                    <span className="tabular shrink-0 font-medium">
                      {formatarHora(evento.hora_inicio)}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {evento.titulo ?? ROTULOS_TIPO_EVENTO_CURTO[evento.tipo]}
                    </span>
                  </span>
                ))}
                {doDia.length > CABEM_NA_CELULA ? (
                  <span className="px-1 text-[0.7rem] text-muted-foreground">
                    mais {doDia.length - CABEM_NA_CELULA}
                  </span>
                ) : null}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/** Legenda das cores, que de outra forma não se adivinham. */
export function LegendaTipos() {
  return (
    <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {(Object.keys(COR_POR_TIPO) as (keyof typeof COR_POR_TIPO)[]).map(
        (tipo) => (
          <li key={tipo} className="flex items-center gap-1.5">
            <span
              className={cn(
                'block size-2 rounded-full',
                CORES_PONTO[COR_POR_TIPO[tipo]],
              )}
            />
            {ROTULOS_TIPO_EVENTO_CURTO[tipo]}
          </li>
        ),
      )}
    </ul>
  )
}
