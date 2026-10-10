import Link from 'next/link'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  Distintivo,
} from '@/components/ui/superficie'
import { COR_POR_TIPO } from '@/components/lista-eventos'
import { ROTULOS_TIPO_EVENTO_CURTO } from '@/lib/rotulos'
import { formatarIntervalo } from '@/lib/formatos'
import type { TipoEvento } from '@/lib/tipos-bd'

/**
 * Um evento com tudo o que o quadro do dia precisa de mostrar: quem está
 * convocado, que cavalo leva cada um, e os avisos.
 *
 * É a vista de quem está na cavalariça a preparar a aula seguinte, por isso a
 * lista de pares aluno↔cavalo aparece sempre aberta e não atrás de um clique.
 */

export type EventoCompleto = {
  id: string
  tipo: TipoEvento
  titulo: string | null
  hora_inicio: string
  hora_fim: string
  local: string | null
  cancelado: boolean
  motivo_cancelamento: string | null
  pessoas: { id: string; nome: string } | null
  equipas: { id: string; nome: string } | null
  evento_participantes:
    | {
        id: string
        estado: string
        pessoas: { id: string; nome: string } | null
        cavalos: { id: string; nome: string } | null
      }[]
    | null
  avisos: { id: string; texto: string }[] | null
}

export function CartaoEvento({
  evento,
  podeEditar,
}: {
  evento: EventoCompleto
  podeEditar: boolean
}) {
  const participantes = evento.evento_participantes ?? []
  const avisos = evento.avisos ?? []

  return (
    <Cartao className={evento.cancelado ? 'opacity-70' : undefined}>
      <CabecalhoCartao className="pb-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="tabular text-lg font-semibold tracking-tight">
            {formatarIntervalo(evento.hora_inicio, evento.hora_fim)}
          </span>
          <Distintivo cor={COR_POR_TIPO[evento.tipo]}>
            {ROTULOS_TIPO_EVENTO_CURTO[evento.tipo]}
          </Distintivo>
          {evento.titulo ? (
            <span className="font-medium">{evento.titulo}</span>
          ) : null}
          {evento.cancelado ? (
            <Distintivo cor="perigo">Cancelado</Distintivo>
          ) : null}
          <Link
            href={`/agenda/${evento.id}`}
            className="ml-auto text-sm text-primary underline-offset-4 hover:underline"
          >
            {podeEditar ? 'Abrir' : 'Ver'}
          </Link>
        </div>

        <p className="text-sm text-muted-foreground">
          {[evento.local, evento.pessoas?.nome, evento.equipas?.nome]
            .filter(Boolean)
            .join(' · ') || 'Sem local nem responsável'}
        </p>
      </CabecalhoCartao>

      <ConteudoCartao className="pt-0">
        {evento.cancelado && evento.motivo_cancelamento ? (
          <p className="mb-3 text-sm text-destructive">
            {evento.motivo_cancelamento}
          </p>
        ) : null}

        {participantes.length > 0 ? (
          <ul className="divide-y divide-border rounded-md border border-border">
            {participantes.map((participante) => (
              <li
                key={participante.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">
                  {participante.pessoas?.nome ?? '—'}
                </span>
                <span
                  className={
                    participante.cavalos
                      ? 'shrink-0 font-medium'
                      : 'shrink-0 text-muted-foreground'
                  }
                >
                  {participante.cavalos?.nome ?? 'sem cavalo'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Ainda ninguém convocado.</p>
        )}

        {avisos.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {avisos.map((aviso) => (
              <li
                key={aviso.id}
                className="rounded-md border-l-[3px] border-primary bg-primary/8 px-3 py-2 text-sm"
              >
                {aviso.texto}
              </li>
            ))}
          </ul>
        ) : null}
      </ConteudoCartao>
    </Cartao>
  )
}
