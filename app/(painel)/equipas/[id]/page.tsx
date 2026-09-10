import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirPessoa } from '@/lib/sessao'
import { eInstrutorOuGestao } from '@/lib/permissoes'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { ErroConsulta } from '@/components/erro-consulta'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposEquipa } from '@/components/formularios/campos-equipa'
import { Avisos } from '@/components/avisos'
import { BotaoApagar } from '@/components/botao-apagar'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  Distintivo,
  SemRegistos,
  TituloCartao,
} from '@/components/ui/superficie'
import { apagarEquipa, guardarEquipa } from '@/lib/accoes/eventos'
import { pessoasActivas } from '@/lib/consultas'
import { ROTULOS_TIPO_EVENTO_CURTO } from '@/lib/rotulos'
import { formatarData, formatarIntervalo, hoje } from '@/lib/formatos'

export const metadata: Metadata = { title: 'Equipa' }

export default async function PaginaEquipa({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sessao = await exigirPessoa()
  const { id } = await params
  const supabase = await criarClienteServidor()

  const { data: equipa, error } = await supabase
    .from('equipas')
    .select(
      `*,
       equipa_membros(pessoa_id, pessoas(id, nome)),
       avisos(id, texto, criado_em, pessoas(nome))`,
    )
    .eq('id', id)
    .maybeSingle()

  if (error) return <ErroConsulta erro={error} contexto="a equipa" />
  if (!equipa) notFound()

  const podeEditar = eInstrutorOuGestao(sessao.perfil)

  const [pessoas, proximos] = await Promise.all([
    podeEditar ? pessoasActivas(supabase) : Promise.resolve([]),
    supabase
      .from('eventos')
      .select('id, tipo, titulo, data, hora_inicio, hora_fim, cancelado')
      .eq('equipa_id', id)
      .gte('data', hoje())
      .order('data')
      .limit(10),
  ])

  const membros = (equipa.equipa_membros ?? []).map((m) => m.pessoas)

  return (
    <>
      <CabecalhoPagina
        titulo={equipa.nome}
        descricao={
          <span className="flex flex-wrap items-center gap-1.5">
            {equipa.escalao ? <Distintivo>{equipa.escalao}</Distintivo> : null}
            <Distintivo>{membros.length} jogadores</Distintivo>
            {!equipa.activa ? <Distintivo cor="aviso">Inactiva</Distintivo> : null}
          </span>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          {podeEditar ? (
            <Cartao>
              <ConteudoCartao className="pt-4 sm:pt-5">
                <FormularioEntidade
                  accao={guardarEquipa}
                  id={equipa.id}
                  hrefCancelar="/equipas"
                  extra={
                    <BotaoApagar
                      accao={apagarEquipa}
                      id={equipa.id}
                      confirmacao="Apagar esta equipa? Os treinos já marcados ficam, mas deixam de estar associados."
                    />
                  }
                >
                  <CamposEquipa
                    equipa={equipa}
                    pessoas={pessoas}
                    membros={membros.map((m) => m?.id ?? '')}
                  />
                </FormularioEntidade>
              </ConteudoCartao>
            </Cartao>
          ) : (
            <Cartao>
              <CabecalhoCartao>
                <TituloCartao>Jogadores</TituloCartao>
              </CabecalhoCartao>
              <ConteudoCartao>
                <ul className="space-y-1 text-sm">
                  {membros.map((membro) => (
                    <li key={membro?.id}>{membro?.nome}</li>
                  ))}
                </ul>
              </ConteudoCartao>
            </Cartao>
          )}

          <Cartao>
            <CabecalhoCartao>
              <TituloCartao>Avisos da equipa</TituloCartao>
              <DescricaoCartao>
                Para o que vale para todos os treinos, não só para um.
              </DescricaoCartao>
            </CabecalhoCartao>
            <ConteudoCartao>
              <Avisos
                avisos={(equipa.avisos ?? []).map((aviso) => ({
                  id: aviso.id,
                  texto: aviso.texto,
                  criado_em: aviso.criado_em,
                  autor: aviso.pessoas,
                }))}
                equipaId={equipa.id}
                voltar={`/equipas/${equipa.id}`}
                podeEscrever={podeEditar}
              />
            </ConteudoCartao>
          </Cartao>
        </div>

        <Cartao className="h-fit">
          <CabecalhoCartao>
            <TituloCartao>Próximos treinos</TituloCartao>
          </CabecalhoCartao>
          <ConteudoCartao className="px-0 sm:px-0">
            {proximos.data && proximos.data.length > 0 ? (
              <ul className="divide-y divide-border">
                {proximos.data.map((evento) => (
                  <li key={evento.id} className="px-4 py-2.5 text-sm sm:px-5">
                    <Link
                      href={`/agenda/${evento.id}`}
                      className="flex items-baseline justify-between gap-2 underline-offset-2 hover:underline"
                    >
                      <span>
                        {formatarData(evento.data)} ·{' '}
                        {formatarIntervalo(evento.hora_inicio, evento.hora_fim)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {evento.cancelado
                          ? 'cancelado'
                          : ROTULOS_TIPO_EVENTO_CURTO[evento.tipo]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <SemRegistos titulo="Nada marcado" />
            )}
          </ConteudoCartao>
        </Cartao>
      </div>
    </>
  )
}
