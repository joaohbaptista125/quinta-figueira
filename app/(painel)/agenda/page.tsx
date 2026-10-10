import type { Metadata } from 'next'
import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirPessoa } from '@/lib/sessao'
import { eInstrutorOuGestao } from '@/lib/permissoes'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import {
  NavegacaoAgenda,
  type VistaAgenda,
} from '@/components/navegacao-agenda'
import { CalendarioMes, LegendaTipos } from '@/components/calendario-mes'
import { type EventoCompleto } from '@/components/cartao-evento'
import { VistaDia, VistaSemana } from '@/components/vistas-agenda'
import { CAMPOS_EVENTO, type Evento } from '@/components/lista-eventos'
import { classesBotao } from '@/components/ui/botao'
import { Cartao, SemRegistos } from '@/components/ui/superficie'
import {
  diasDaSemana,
  formatarDiaPorExtenso,
  formatarIntervaloDeDias,
  formatarMesCapitalizado,
  gradeDoMes,
  hoje,
} from '@/lib/formatos'

export const metadata: Metadata = { title: 'Agenda' }

const VISTAS_VALIDAS: VistaAgenda[] = ['mes', 'semana', 'dia']

/** Os campos a mais que só o quadro do dia precisa. */
const CAMPOS_COMPLETOS = `id, tipo, titulo, data, hora_inicio, hora_fim, local,
   cancelado, motivo_cancelamento, notas,
   pessoas(id, nome), equipas(id, nome),
   evento_participantes(id, estado, pessoas(id, nome), cavalos(id, nome)),
   avisos(id, texto)`

/**
 * A agenda, em três vistas sobre os mesmos eventos.
 *
 * Abria sempre no quadro de um dia, e um dia não diz nada sobre a semana a
 * seguir. Agora abre no mês, que é a pergunta de quem planeia; a semana e o
 * dia estão a um toque, e o dia continua a ser o quadro detalhado de sempre,
 * com os pares aluno↔cavalo à vista.
 *
 * O `?dia=` é sempre um dia, mesmo nas vistas de mês e de semana — serve para
 * dizer qual. É isso que faz mudar de vista não perder o sítio.
 */
export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; vista?: string }>
}) {
  const sessao = await exigirPessoa()
  const { dia: diaBruto, vista: vistaBruta } = await searchParams

  const dia = /^\d{4}-\d{2}-\d{2}$/.test(diaBruto ?? '') ? diaBruto! : hoje()
  const vista = VISTAS_VALIDAS.includes(vistaBruta as VistaAgenda)
    ? (vistaBruta as VistaAgenda)
    : 'mes'
  const podeEditar = eInstrutorOuGestao(sessao.perfil)

  const dias =
    vista === 'mes' ? gradeDoMes(dia) : vista === 'semana' ? diasDaSemana(dia) : [dia]
  const de = dias[0]
  const ate = dias[dias.length - 1]

  const supabase = await criarClienteServidor()

  // Duas consultas em vez de um `select` condicional: o quadro do dia mostra
  // os convocados e os avisos, o mês e a semana só precisam de contar e não
  // vale a pena carregar os nomes de sessenta linhas. Escritas à parte porque
  // os tipos do Supabase exigem um `select` literal para saberem o que volta.
  let erro: string | null = null
  let eventosLeves: Evento[] = []
  let eventosCompletos: EventoCompleto[] = []

  if (vista === 'dia') {
    const { data, error } = await supabase
      .from('eventos')
      .select(CAMPOS_COMPLETOS)
      .gte('data', de)
      .lte('data', ate)
      .order('hora_inicio')
    erro = error?.message ?? null
    eventosCompletos = (data ?? []) as unknown as EventoCompleto[]
  } else {
    const { data, error } = await supabase
      .from('eventos')
      .select(CAMPOS_EVENTO)
      .gte('data', de)
      .lte('data', ate)
      .order('data')
      .order('hora_inicio')
    erro = error?.message ?? null
    eventosLeves = (data ?? []) as Evento[]
  }

  const titulo =
    vista === 'mes'
      ? formatarMesCapitalizado(dia)
      : vista === 'semana'
        ? formatarIntervaloDeDias(de, ate)
        : dia === hoje()
          ? 'Hoje'
          : formatarDiaPorExtenso(dia)

  const descricao =
    vista === 'dia' && dia === hoje() ? formatarDiaPorExtenso(dia) : undefined

  return (
    <>
      <CabecalhoPagina
        titulo={titulo}
        descricao={descricao}
        accoes={
          podeEditar ? (
            <Link href={`/agenda/novo?dia=${dia}`} className={classesBotao()}>
              Marcar
            </Link>
          ) : null
        }
      />

      <div className="mb-4">
        <NavegacaoAgenda vista={vista} dia={dia} />
      </div>

      {erro ? (
        <Cartao>
          <SemRegistos titulo="Não foi possível carregar" descricao={erro} />
        </Cartao>
      ) : vista === 'mes' ? (
        <>
          <CalendarioMes periodo={dia} eventos={eventosLeves} />
          <LegendaTipos />
        </>
      ) : vista === 'semana' ? (
        <VistaSemana dias={dias} eventos={eventosLeves} podeEditar={podeEditar} />
      ) : (
        <VistaDia dia={dia} eventos={eventosCompletos} podeEditar={podeEditar} />
      )}
    </>
  )
}
