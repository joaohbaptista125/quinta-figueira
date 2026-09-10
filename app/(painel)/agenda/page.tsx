import type { Metadata } from 'next'
import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirPessoa } from '@/lib/sessao'
import { eInstrutorOuGestao } from '@/lib/permissoes'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { SelectorDia } from '@/components/selector-dia'
import { classesBotao } from '@/components/ui/botao'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  Distintivo,
  SemRegistos,
} from '@/components/ui/superficie'
import { ROTULOS_TIPO_EVENTO_CURTO } from '@/lib/rotulos'
import {
  formatarDiaPorExtenso,
  formatarIntervalo,
  hoje,
} from '@/lib/formatos'
import type { TipoEvento } from '@/lib/tipos-bd'

export const metadata: Metadata = { title: 'Agenda' }

const COR_POR_TIPO: Record<TipoEvento, 'primario' | 'aviso' | 'sucesso'> = {
  aula: 'primario',
  treino_horseball: 'sucesso',
  competicao: 'aviso',
}

export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>
}) {
  const sessao = await exigirPessoa()
  const { dia: diaBruto } = await searchParams
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(diaBruto ?? '') ? diaBruto! : hoje()
  const podeEditar = eInstrutorOuGestao(sessao.perfil)

  const supabase = await criarClienteServidor()
  const { data: eventos, error } = await supabase
    .from('eventos')
    .select(
      `id, tipo, titulo, hora_inicio, hora_fim, local, cancelado, motivo_cancelamento, notas,
       pessoas(id, nome),
       equipas(id, nome),
       evento_participantes(id, estado, pessoas(id, nome), cavalos(id, nome)),
       avisos(id, texto)`,
    )
    .eq('data', dia)
    .order('hora_inicio')

  return (
    <>
      <CabecalhoPagina
        titulo={dia === hoje() ? 'Hoje' : formatarDiaPorExtenso(dia)}
        descricao={
          dia === hoje() ? formatarDiaPorExtenso(dia) : 'Quadro do dia'
        }
        accoes={
          <>
            <SelectorDia dia={dia} />
            {podeEditar ? (
              <Link href={`/agenda/novo?dia=${dia}`} className={classesBotao()}>
                Marcar
              </Link>
            ) : null}
          </>
        }
      />

      {error ? (
        <Cartao>
          <SemRegistos titulo="Não foi possível carregar" descricao={error.message} />
        </Cartao>
      ) : eventos && eventos.length > 0 ? (
        <ol className="space-y-3">
          {eventos.map((evento) => {
            const participantes = evento.evento_participantes ?? []
            return (
              <li key={evento.id}>
                <Cartao
                  className={evento.cancelado ? 'opacity-70' : undefined}
                >
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
                      {[
                        evento.local,
                        evento.pessoas?.nome,
                        evento.equipas?.nome,
                      ]
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
                      <p className="text-sm text-muted-foreground">
                        Ainda ninguém convocado.
                      </p>
                    )}

                    {(evento.avisos ?? []).length > 0 ? (
                      <ul className="mt-3 space-y-1">
                        {(evento.avisos ?? []).map((aviso) => (
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
              </li>
            )
          })}
        </ol>
      ) : (
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
      )}
    </>
  )
}
