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
import { SerieEvento } from '@/components/serie-evento'
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
import { cavalosActivos, nomesVisiveis, pessoasActivas } from '@/lib/consultas'
import { ROTULOS_TIPO_EVENTO } from '@/lib/rotulos'
import { agoraLocal, formatarDiaPorExtenso, formatarIntervalo } from '@/lib/formatos'
import { ResponderConvocatoria } from '@/components/responder-convocatoria'

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
      /*
       * **Nenhum `pessoas(...)` nem `cavalos(...)` embebido, e é de
       * propósito.** `pessoas_ler` só deixa a equipa do centro ler fichas e
       * `cavalos_ler` só a equipa e o dono — por isso, para um cliente
       * convocado, estes embeds vinham vazios e a convocatória era uma lista
       * de linhas em branco. Os nomes vêm de `nomesVisiveis()`, que devolve
       * só id e nome. É a mesma decisão da ficha da equipa.
       */
      `*,
       evento_participantes(id, estado, pessoa_id, cavalo_id, confirmacao, confirmado_em, motivo_ausencia),
       avisos(id, texto, criado_em, autor_id)`,
    )
    .order('criado_em', { referencedTable: 'avisos', ascending: true })
    .eq('id', id)
    .maybeSingle()

  if (error) return <ErroConsulta erro={error} contexto="o evento" />
  if (!evento) notFound()

  const podeEditar = eInstrutorOuGestao(sessao.perfil)

  const [pessoas, cavalos, equipas, nomes] = await Promise.all([
    podeEditar ? pessoasActivas(supabase) : Promise.resolve([]),
    podeEditar ? cavalosActivos(supabase) : Promise.resolve([]),
    podeEditar
      ? supabase.from('equipas').select('id, nome').eq('activa', true).order('nome')
      : Promise.resolve({ data: [] }),
    nomesVisiveis(supabase),
  ])

  const nomeDaPessoa = nomes.pessoas
  const nomeDoCavalo = nomes.cavalos

  // A série é uma etiqueta, não um dono: só se vai buscá-la quando existe, e
  // só para dizer em que ponto da repetição esta marcação está.
  const { data: marcacoes } = evento.serie_id
    ? await supabase
        .from('eventos')
        .select('id, data, cancelado')
        .eq('serie_id', evento.serie_id)
        .order('data')
    : { data: null }

  const convocados = (evento.evento_participantes ?? []).map((linha) => ({
    id: linha.id,
    estado: linha.estado,
    confirmacao: linha.confirmacao,
    motivo_ausencia: linha.motivo_ausencia,
    pessoa: linha.pessoa_id
      ? { id: linha.pessoa_id, nome: nomeDaPessoa.get(linha.pessoa_id) ?? 'Alguém' }
      : null,
    cavalo: linha.cavalo_id
      ? { id: linha.cavalo_id, nome: nomeDoCavalo.get(linha.cavalo_id) ?? 'Cavalo' }
      : null,
  }))

  // A linha de quem está a ver, se tiver sido convocado. É o que lhe dá o
  // «vou»/«não vou» — e aparece a toda a gente, instrutores incluídos: também
  // eles são convocados para competições.
  const minhaLinha = (evento.evento_participantes ?? []).find(
    (linha) => linha.pessoa_id === sessao.id,
  )

  // Depois da hora de início já não há nada a responder: o que interessa
  // passa a ser a presença, e essa escreve-a a equipa.
  const jaPassou = `${evento.data}T${evento.hora_inicio}` < agoraLocal()

  const avisos = (evento.avisos ?? []).map((aviso) => ({
    id: aviso.id,
    texto: aviso.texto,
    criado_em: aviso.criado_em,
    autor: aviso.autor_id
      ? { nome: nomeDaPessoa.get(aviso.autor_id) ?? 'Alguém' }
      : null,
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
          {minhaLinha && !evento.cancelado ? (
            <Cartao>
              <CabecalhoCartao>
                <TituloCartao>Foi convocado</TituloCartao>
                <DescricaoCartao>
                  Isto não é a presença — é o que conta fazer, para quem
                  organiza saber a tempo.
                </DescricaoCartao>
              </CabecalhoCartao>
              <ConteudoCartao>
                <ResponderConvocatoria
                  eventoId={evento.id}
                  confirmacao={minhaLinha.confirmacao}
                  confirmadoEm={minhaLinha.confirmado_em}
                  motivo={minhaLinha.motivo_ausencia}
                  passou={jaPassou}
                />
              </ConteudoCartao>
            </Cartao>
          ) : null}

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

            {marcacoes && marcacoes.length > 1 ? (
              <Cartao>
                <CabecalhoCartao>
                  <TituloCartao>Repetição</TituloCartao>
                  <DescricaoCartao>
                    Cada marcação é independente. Mudar a hora ou um convocado
                    aqui não mexe nas outras.
                  </DescricaoCartao>
                </CabecalhoCartao>
                <ConteudoCartao>
                  <SerieEvento
                    eventoId={evento.id}
                    marcacoes={marcacoes}
                    podeEditar={podeEditar}
                  />
                </ConteudoCartao>
              </Cartao>
            ) : null}

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
