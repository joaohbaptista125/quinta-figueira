import Link from 'next/link'
import { ChevronRight, Megaphone } from 'lucide-react'
import { Distintivo } from '@/components/ui/superficie'
import { ROTULOS_TIPO_EVENTO_CURTO } from '@/lib/rotulos'
import { formatarDiaCurto, formatarHora } from '@/lib/formatos'
import type { TipoEvento } from '@/lib/tipos-bd'

/*
 * A linha de um evento, do tamanho de uma linha.
 *
 * É o mesmo desenho no painel («Hoje»), na vista de semana da agenda e nas
 * próximas marcações do cliente — por isso vive aqui e não em nenhuma delas.
 * O que cada sítio muda é só se mostra ou não a data.
 */

/**
 * Uma cor por tipo de evento, e as três têm de se distinguir num ponto de seis
 * pixels na grelha do mês. O verde de «sucesso» que o Horseball usava era a
 * mesma mancha que o verde de acção das aulas, daí o azul.
 */
export const COR_POR_TIPO: Record<
  TipoEvento,
  'primario' | 'informacao' | 'aviso'
> = {
  aula: 'primario',
  treino_horseball: 'informacao',
  competicao: 'aviso',
}

/** Os campos que a linha precisa. Serve de `select` às consultas. */
export const CAMPOS_EVENTO = `id, tipo, titulo, data, hora_inicio, hora_fim, local, cancelado,
   pessoas(nome), equipas(nome),
   evento_participantes(id, cavalo_id),
   avisos(id)`

export type Evento = {
  id: string
  tipo: TipoEvento
  titulo: string | null
  data: string
  hora_inicio: string
  hora_fim: string
  local: string | null
  cancelado: boolean
  pessoas: { nome: string } | null
  equipas: { nome: string } | null
  evento_participantes: { id: string; cavalo_id: string | null }[] | null
  avisos: { id: string }[] | null
}

export function ListaEventos({
  eventos,
  mostrarDia,
}: {
  eventos: Evento[]
  mostrarDia?: boolean
}) {
  return (
    <ol className="divide-y divide-border border-t border-border">
      {eventos.map((evento) => {
        const participantes = evento.evento_participantes ?? []
        const semCavalo = participantes.filter((p) => !p.cavalo_id).length
        const avisos = (evento.avisos ?? []).length
        const contexto = [evento.local, evento.pessoas?.nome, evento.equipas?.nome]
          .filter(Boolean)
          .join(' · ')

        return (
          <li key={evento.id} className="relative hover:bg-muted/50">
            <Link
              href={`/agenda/${evento.id}`}
              className="flex items-center gap-3 px-4 py-3 sm:px-5"
            >
              <span className="w-[4.5rem] shrink-0">
                <span className="tabular block text-sm font-semibold">
                  {formatarHora(evento.hora_inicio)}
                </span>
                {mostrarDia ? (
                  <span className="tabular block text-xs text-muted-foreground">
                    {formatarDiaCurto(evento.data)}
                  </span>
                ) : null}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Distintivo cor={COR_POR_TIPO[evento.tipo]}>
                    {ROTULOS_TIPO_EVENTO_CURTO[evento.tipo]}
                  </Distintivo>
                  {evento.titulo ? (
                    <span className="truncate font-medium">{evento.titulo}</span>
                  ) : null}
                  {evento.cancelado ? (
                    <Distintivo cor="perigo">Cancelado</Distintivo>
                  ) : null}
                </span>
                {contexto ? (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {contexto}
                  </span>
                ) : null}
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>
                    {participantes.length === 1
                      ? '1 convocado'
                      : `${participantes.length} convocados`}
                  </span>
                  {semCavalo > 0 && !evento.cancelado ? (
                    <span className="font-medium text-warning-foreground">
                      {semCavalo === 1
                        ? '1 ainda sem cavalo'
                        : `${semCavalo} ainda sem cavalo`}
                    </span>
                  ) : null}
                  {avisos > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Megaphone className="size-3" aria-hidden />
                      {avisos}
                    </span>
                  ) : null}
                </span>
              </span>

              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
