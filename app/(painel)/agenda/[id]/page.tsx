import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirPessoa } from '@/lib/sessao'
import { eInstrutorOuGestao } from '@/lib/permissoes'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { ErroConsulta } from '@/components/erro-consulta'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposEvento } from '@/components/formularios/campos-evento'
import { Convocatoria } from '@/components/convocatoria'
import { Avisos } from '@/components/avisos'
import { CancelarEvento } from '@/components/cancelar-evento'
import { BotaoApagar } from '@/components/botao-apagar'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  Distintivo,
  TituloCartao,
} from '@/components/ui/superficie'
import { apagarEvento, guardarEvento } from '@/lib/accoes/eventos'
import { cavalosActivos, pessoasActivas } from '@/lib/consultas'
import { ROTULOS_TIPO_EVENTO } from '@/lib/rotulos'
import { formatarDiaPorExtenso, formatarIntervalo } from '@/lib/formatos'

export const metadata: Metadata = { title: 'Evento' }

export default async function PaginaEvento({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sessao = await exigirPessoa()
  const { id } = await params
  const supabase = await criarClienteServidor()

  const { data: evento, error } = await supabase
    .from('eventos')
    .select(
      `*,
       evento_participantes(id, estado, pessoas(id, nome), cavalos(id, nome)),
       avisos(id, texto, criado_em, pessoas(nome))`,
    )
    .eq('id', id)
    .maybeSingle()

  if (error) return <ErroConsulta erro={error} contexto="o evento" />
  if (!evento) notFound()

  const podeEditar = eInstrutorOuGestao(sessao.perfil)

  const [pessoas, cavalos, equipas] = await Promise.all([
    podeEditar ? pessoasActivas(supabase) : Promise.resolve([]),
    podeEditar ? cavalosActivos(supabase) : Promise.resolve([]),
    podeEditar
      ? supabase.from('equipas').select('id, nome').eq('activa', true).order('nome')
      : Promise.resolve({ data: [] }),
  ])

  const convocados = (evento.evento_participantes ?? []).map((linha) => ({
    id: linha.id,
    estado: linha.estado,
    pessoa: linha.pessoas,
    cavalo: linha.cavalos,
  }))

  const avisos = (evento.avisos ?? []).map((aviso) => ({
    id: aviso.id,
    texto: aviso.texto,
    criado_em: aviso.criado_em,
    autor: aviso.pessoas,
  }))

  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/agenda', rotulo: 'Agenda' }}
        titulo={evento.titulo || ROTULOS_TIPO_EVENTO[evento.tipo]}
        descricao={
          <span className="flex flex-wrap items-center gap-1.5">
            <span>
              {formatarDiaPorExtenso(evento.data)},{' '}
              {formatarIntervalo(evento.hora_inicio, evento.hora_fim)}
            </span>
            <Distintivo>{ROTULOS_TIPO_EVENTO[evento.tipo]}</Distintivo>
            {evento.local ? <Distintivo>{evento.local}</Distintivo> : null}
            {evento.cancelado ? (
              <Distintivo cor="perigo">Cancelado</Distintivo>
            ) : null}
          </span>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <Cartao>
            <CabecalhoCartao>
              <TituloCartao>Convocatória</TituloCartao>
              <DescricaoCartao>
                Quem participa e que cavalo monta. Um cavalo não pode estar em
                dois sítios à mesma hora.
              </DescricaoCartao>
            </CabecalhoCartao>
            <ConteudoCartao>
              <Convocatoria
                eventoId={evento.id}
                convocados={convocados}
                pessoas={pessoas}
                cavalos={cavalos}
                podeEditar={podeEditar && !evento.cancelado}
              />
            </ConteudoCartao>
          </Cartao>

          <Cartao>
            <CabecalhoCartao>
              <TituloCartao>Avisos</TituloCartao>
              <DescricaoCartao>
                Aparecem no quadro do dia e na descrição do evento no calendário
                de quem está convocado.
              </DescricaoCartao>
            </CabecalhoCartao>
            <ConteudoCartao>
              <Avisos
                avisos={avisos}
                eventoId={evento.id}
                voltar={`/agenda/${evento.id}`}
                podeEscrever={podeEditar}
              />
            </ConteudoCartao>
          </Cartao>
        </div>

        {podeEditar ? (
          <div className="space-y-4">
            <Cartao>
              <CabecalhoCartao>
                <TituloCartao>Dados</TituloCartao>
              </CabecalhoCartao>
              <ConteudoCartao>
                <FormularioEntidade
                  accao={guardarEvento}
                  id={evento.id}
                  hrefCancelar={`/agenda?dia=${evento.data}`}
                >
                  <CamposEvento
                    evento={evento}
                    responsaveis={pessoas}
                    equipas={equipas.data ?? []}
                  />
                </FormularioEntidade>
              </ConteudoCartao>
            </Cartao>

            <Cartao>
              <CabecalhoCartao>
                <TituloCartao>
                  {evento.cancelado ? 'Reabrir' : 'Cancelar'}
                </TituloCartao>
              </CabecalhoCartao>
              <ConteudoCartao className="space-y-4">
                <CancelarEvento id={evento.id} cancelado={evento.cancelado} />
                <div className="border-t border-border pt-4">
                  <BotaoApagar
                    accao={apagarEvento}
                    id={evento.id}
                    confirmacao="Apagar este evento? A convocatória e os avisos desaparecem com ele. Para manter o registo, prefira cancelar."
                  />
                </div>
              </ConteudoCartao>
            </Cartao>
          </div>
        ) : evento.notas ? (
          <Cartao className="h-fit">
            <CabecalhoCartao>
              <TituloCartao>Notas</TituloCartao>
            </CabecalhoCartao>
            <ConteudoCartao>
              <p className="whitespace-pre-wrap text-sm">{evento.notas}</p>
            </ConteudoCartao>
          </Cartao>
        ) : null}
      </div>
    </>
  )
}
