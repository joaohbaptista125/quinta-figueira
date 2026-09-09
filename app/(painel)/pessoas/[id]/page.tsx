import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirPessoa } from '@/lib/sessao'
import { eGestao } from '@/lib/permissoes'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposPessoa } from '@/components/formularios/campos-pessoa'
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
import { Cabecalho, Corpo, Linha, Tabela, Td, Th } from '@/components/ui/tabela'
import { apagarPessoa, guardarPessoa } from '@/lib/accoes/pessoas'
import {
  ROTULOS_METODO,
  ROTULOS_PAPEL,
  ROTULOS_PERFIL,
  ROTULOS_REGIME,
} from '@/lib/rotulos'
import { formatarData, formatarEuros } from '@/lib/formatos'
import type { PapelPessoa } from '@/lib/tipos-bd'

export const metadata: Metadata = { title: 'Ficha de pessoa' }

export default async function PaginaPessoa({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sessao = await exigirPessoa()
  const { id } = await params
  const supabase = await criarClienteServidor()

  const { data: pessoa } = await supabase
    .from('pessoas')
    .select('*, pessoa_papeis(papel)')
    .eq('id', id)
    .maybeSingle()

  if (!pessoa) notFound()

  const papeis = ((pessoa.pessoa_papeis ?? []) as { papel: PapelPessoa }[]).map(
    (relacao) => relacao.papel,
  )
  const podeEditar = eGestao(sessao.perfil)

  const [cavalos, contratos, recebimentos] = await Promise.all([
    supabase
      .from('cavalos')
      .select('id, nome, regime, activo')
      .eq('proprietario_id', id)
      .order('nome'),
    podeEditar
      ? supabase
          .from('contratos_penso')
          .select('id, valor_mensal, data_inicio, data_fim, cavalos(nome)')
          .eq('cliente_id', id)
          .order('data_inicio', { ascending: false })
      : Promise.resolve({ data: null }),
    podeEditar
      ? supabase
          .from('recebimentos')
          .select('id, data, valor, tipo, metodo_pagamento, descricao')
          .eq('pessoa_id', id)
          .order('data', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: null }),
  ])

  return (
    <>
      <CabecalhoPagina
        titulo={pessoa.nome}
        descricao={
          <span className="flex flex-wrap items-center gap-1.5">
            {papeis.map((papel) => (
              <Distintivo key={papel} cor="primario">
                {ROTULOS_PAPEL[papel]}
              </Distintivo>
            ))}
            {pessoa.perfil ? (
              <Distintivo>{ROTULOS_PERFIL[pessoa.perfil]}</Distintivo>
            ) : null}
            {!pessoa.activo ? <Distintivo cor="aviso">Inactivo</Distintivo> : null}
          </span>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Cartao>
          <CabecalhoCartao>
            <TituloCartao>{podeEditar ? 'Dados' : 'Contactos'}</TituloCartao>
          </CabecalhoCartao>
          <ConteudoCartao>
            {podeEditar ? (
              <FormularioEntidade
                accao={guardarPessoa}
                id={pessoa.id}
                hrefCancelar="/pessoas"
                extra={
                  <BotaoApagar
                    accao={apagarPessoa}
                    id={pessoa.id}
                    confirmacao={`Apagar ${pessoa.nome}? Se tiver cavalos ou movimentos associados, prefira marcar como inactivo.`}
                  />
                }
              >
                <CamposPessoa
                  pessoa={pessoa}
                  papeis={papeis}
                  temLogin={Boolean(pessoa.auth_user_id)}
                />
              </FormularioEntidade>
            ) : (
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>{pessoa.email ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Telefone</dt>
                  <dd>{pessoa.telefone ?? '—'}</dd>
                </div>
              </dl>
            )}
          </ConteudoCartao>
        </Cartao>

        <div className="space-y-4">
          <Cartao>
            <CabecalhoCartao>
              <TituloCartao>Cavalos</TituloCartao>
              <DescricaoCartao>Cavalos de que é proprietário</DescricaoCartao>
            </CabecalhoCartao>
            <ConteudoCartao className="px-0 sm:px-0">
              {cavalos.data && cavalos.data.length > 0 ? (
                <Tabela>
                  <Corpo>
                    {cavalos.data.map((cavalo) => (
                      <Linha key={cavalo.id}>
                        <Td>
                          <Link
                            href={`/cavalos/${cavalo.id}`}
                            className="font-medium underline-offset-2 hover:underline"
                          >
                            {cavalo.nome}
                          </Link>
                        </Td>
                        <Td className="text-right text-muted-foreground">
                          {ROTULOS_REGIME[cavalo.regime]}
                        </Td>
                      </Linha>
                    ))}
                  </Corpo>
                </Tabela>
              ) : (
                <SemRegistos titulo="Nenhum cavalo associado" />
              )}
            </ConteudoCartao>
          </Cartao>

          {podeEditar ? (
            <>
              <Cartao>
                <CabecalhoCartao>
                  <TituloCartao>Contratos de penso</TituloCartao>
                </CabecalhoCartao>
                <ConteudoCartao className="px-0 sm:px-0">
                  {contratos.data && contratos.data.length > 0 ? (
                    <Tabela>
                      <Cabecalho>
                        <Linha>
                          <Th>Cavalo</Th>
                          <Th>Início</Th>
                          <Th numerico>Mensal</Th>
                        </Linha>
                      </Cabecalho>
                      <Corpo>
                        {contratos.data.map((contrato) => (
                          <Linha key={contrato.id}>
                            <Td>
                              <Link
                                href={`/contratos/${contrato.id}`}
                                className="underline-offset-2 hover:underline"
                              >
                                {contrato.cavalos?.nome ?? '—'}
                              </Link>
                              {contrato.data_fim ? (
                                <Distintivo className="ml-2">Terminado</Distintivo>
                              ) : null}
                            </Td>
                            <Td className="whitespace-nowrap text-muted-foreground">
                              {formatarData(contrato.data_inicio)}
                            </Td>
                            <Td numerico>{formatarEuros(contrato.valor_mensal)}</Td>
                          </Linha>
                        ))}
                      </Corpo>
                    </Tabela>
                  ) : (
                    <SemRegistos titulo="Sem contratos de penso" />
                  )}
                </ConteudoCartao>
              </Cartao>

              <Cartao>
                <CabecalhoCartao>
                  <TituloCartao>Últimos recebimentos</TituloCartao>
                </CabecalhoCartao>
                <ConteudoCartao className="px-0 sm:px-0">
                  {recebimentos.data && recebimentos.data.length > 0 ? (
                    <Tabela>
                      <Corpo>
                        {recebimentos.data.map((recebimento) => (
                          <Linha key={recebimento.id}>
                            <Td className="whitespace-nowrap text-muted-foreground">
                              {formatarData(recebimento.data)}
                            </Td>
                            <Td className="text-xs">
                              {ROTULOS_METODO[recebimento.metodo_pagamento]}
                            </Td>
                            <Td numerico className="font-medium">
                              {formatarEuros(recebimento.valor)}
                            </Td>
                          </Linha>
                        ))}
                      </Corpo>
                    </Tabela>
                  ) : (
                    <SemRegistos titulo="Sem recebimentos registados" />
                  )}
                </ConteudoCartao>
              </Cartao>
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}
