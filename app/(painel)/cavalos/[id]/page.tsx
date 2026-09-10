import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirPessoa } from '@/lib/sessao'
import { eGestao } from '@/lib/permissoes'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { ErroConsulta } from '@/components/erro-consulta'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposCavalo } from '@/components/formularios/campos-cavalo'
import { BotaoApagar } from '@/components/botao-apagar'
import { FotoCavalo } from '@/components/foto-cavalo'
import { AtribuicaoBox } from '@/components/atribuicao-box'
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
import { apagarCavalo, guardarCavalo } from '@/lib/accoes/cavalos'
import { ROTULOS_REGIME, ROTULOS_SEXO } from '@/lib/rotulos'
import { formatarData, formatarEuros, idadeEmAnos } from '@/lib/formatos'

export const metadata: Metadata = { title: 'Ficha de cavalo' }

export default async function PaginaCavalo({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sessao = await exigirPessoa()
  const { id } = await params
  const supabase = await criarClienteServidor()

  const { data: cavalo, error } = await supabase
    .from('cavalos')
    .select('*, pessoas(id, nome)')
    .eq('id', id)
    .maybeSingle()

  if (error) return <ErroConsulta erro={error} contexto="a ficha do cavalo" />
  if (!cavalo) notFound()

  const podeEditar = eGestao(sessao.perfil)
  const idade = idadeEmAnos(cavalo.data_nascimento)

  const [proprietarios, boxAtribuida, boxesLivres, contratos, despesas] =
    await Promise.all([
      podeEditar
        ? supabase.from('pessoas').select('id, nome').eq('activo', true).order('nome')
        : Promise.resolve({ data: null }),
      supabase.from('boxes').select('id, identificacao, zona').eq('cavalo_id', id).maybeSingle(),
      podeEditar
        ? supabase
            .from('boxes')
            .select('id, identificacao, zona')
            .is('cavalo_id', null)
            .eq('activa', true)
            .order('identificacao')
        : Promise.resolve({ data: null }),
      podeEditar
        ? supabase
            .from('contratos_penso')
            .select('id, valor_mensal, data_inicio, data_fim, pessoas(id, nome)')
            .eq('cavalo_id', id)
            .order('data_inicio', { ascending: false })
        : Promise.resolve({ data: null }),
      podeEditar
        ? supabase
            .from('despesas')
            .select('id, data, descricao, valor_total, categorias_despesa(nome)')
            .eq('cavalo_id', id)
            .order('data', { ascending: false })
            .limit(10)
        : Promise.resolve({ data: null }),
    ])

  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/cavalos', rotulo: 'Cavalos' }}
        titulo={cavalo.nome}
        descricao={
          <span className="flex flex-wrap items-center gap-1.5">
            <Distintivo cor={cavalo.regime === 'penso' ? 'primario' : 'neutro'}>
              {ROTULOS_REGIME[cavalo.regime]}
            </Distintivo>
            {cavalo.sexo ? <Distintivo>{ROTULOS_SEXO[cavalo.sexo]}</Distintivo> : null}
            {idade != null ? <Distintivo>{idade} anos</Distintivo> : null}
            {boxAtribuida.data ? (
              <Distintivo>Box {boxAtribuida.data.identificacao}</Distintivo>
            ) : null}
            {!cavalo.activo ? <Distintivo cor="aviso">Inactivo</Distintivo> : null}
          </span>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Cartao>
          <CabecalhoCartao>
            <TituloCartao>{podeEditar ? 'Dados' : 'Ficha'}</TituloCartao>
          </CabecalhoCartao>
          <ConteudoCartao>
            {podeEditar ? (
              <FormularioEntidade
                accao={guardarCavalo}
                id={cavalo.id}
                hrefCancelar="/cavalos"
                extra={
                  <BotaoApagar
                    accao={apagarCavalo}
                    id={cavalo.id}
                    confirmacao={`Apagar ${cavalo.nome}? Se tiver contratos ou despesas, prefira marcar como inactivo.`}
                  />
                }
              >
                <CamposCavalo cavalo={cavalo} proprietarios={proprietarios.data ?? []} />
              </FormularioEntidade>
            ) : (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Detalhe rotulo="Raça" valor={cavalo.raca} />
                <Detalhe rotulo="Pelagem" valor={cavalo.pelagem} />
                <Detalhe
                  rotulo="Data de nascimento"
                  valor={formatarData(cavalo.data_nascimento)}
                />
                <Detalhe rotulo="Microchip" valor={cavalo.microchip} />
                <Detalhe rotulo="Passaporte" valor={cavalo.num_passaporte} />
                <Detalhe
                  rotulo="Proprietário"
                  valor={cavalo.pessoas?.nome ?? null}
                />
                {cavalo.notas ? (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Notas</dt>
                    <dd className="whitespace-pre-wrap">{cavalo.notas}</dd>
                  </div>
                ) : null}
              </dl>
            )}
          </ConteudoCartao>
        </Cartao>

        <div className="space-y-4">
          <FotoCavalo caminho={cavalo.foto_path} nome={cavalo.nome} />

          {podeEditar ? (
            <Cartao>
              <CabecalhoCartao>
                <TituloCartao>Box</TituloCartao>
                <DescricaoCartao>
                  Cada box aloja um cavalo de cada vez.
                </DescricaoCartao>
              </CabecalhoCartao>
              <ConteudoCartao>
                <AtribuicaoBox
                  cavaloId={cavalo.id}
                  boxActual={boxAtribuida.data ?? null}
                  boxesLivres={boxesLivres.data ?? []}
                />
              </ConteudoCartao>
            </Cartao>
          ) : null}

          {podeEditar ? (
            <>
              <Cartao>
                <CabecalhoCartao className="flex flex-row items-start justify-between gap-2">
                  <TituloCartao>Contratos de penso</TituloCartao>
                  <Link
                    href={`/contratos/novo?cavalo=${cavalo.id}`}
                    className="text-sm text-primary underline"
                  >
                    Novo
                  </Link>
                </CabecalhoCartao>
                <ConteudoCartao className="px-0 sm:px-0">
                  {contratos.data && contratos.data.length > 0 ? (
                    <Tabela>
                      <Cabecalho>
                        <Linha>
                          <Th>Cliente</Th>
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
                                {contrato.pessoas?.nome ?? '—'}
                              </Link>
                              {contrato.data_fim ? (
                                <Distintivo className="ml-2">Terminado</Distintivo>
                              ) : null}
                            </Td>
                            <Td rotulo="Início" className="whitespace-nowrap text-muted-foreground">
                              {formatarData(contrato.data_inicio)}
                            </Td>
                            <Td rotulo="Mensal" numerico>{formatarEuros(contrato.valor_mensal)}</Td>
                          </Linha>
                        ))}
                      </Corpo>
                    </Tabela>
                  ) : (
                    <SemRegistos titulo="Sem contratos" />
                  )}
                </ConteudoCartao>
              </Cartao>

              <Cartao>
                <CabecalhoCartao>
                  <TituloCartao>Despesas imputadas</TituloCartao>
                  <DescricaoCartao>
                    Veterinário, ferrador e outras despesas deste cavalo
                  </DescricaoCartao>
                </CabecalhoCartao>
                <ConteudoCartao className="px-0 sm:px-0">
                  {despesas.data && despesas.data.length > 0 ? (
                    <Tabela>
                      <Corpo>
                        {despesas.data.map((despesa) => (
                          <Linha key={despesa.id}>
                            <Td className="whitespace-nowrap text-muted-foreground">
                              {formatarData(despesa.data)}
                            </Td>
                            <Td>
                              <Link
                                href={`/financeiro/despesas/${despesa.id}`}
                                className="underline-offset-2 hover:underline"
                              >
                                {despesa.descricao}
                              </Link>
                            </Td>
                            <Td numerico>{formatarEuros(despesa.valor_total)}</Td>
                          </Linha>
                        ))}
                      </Corpo>
                    </Tabela>
                  ) : (
                    <SemRegistos titulo="Sem despesas imputadas" />
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

function Detalhe({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd>{valor && valor !== '—' ? valor : '—'}</dd>
    </div>
  )
}
