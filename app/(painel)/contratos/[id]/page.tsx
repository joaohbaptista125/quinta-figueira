import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { exigirGestao } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposContrato } from '@/components/formularios/campos-contrato'
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
import { apagarContrato, guardarContrato } from '@/lib/accoes/cadastro-diverso'
import { cavalosActivos, pessoasActivas } from '@/lib/consultas'
import { formatarEuros, formatarMesCapitalizado } from '@/lib/formatos'
import { ROTULOS_ESTADO_MENSALIDADE } from '@/lib/rotulos'

export const metadata: Metadata = { title: 'Contrato de penso' }

export default async function PaginaContrato({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await exigirGestao()
  const { id } = await params
  const supabase = await criarClienteServidor()

  const { data: contrato } = await supabase
    .from('contratos_penso')
    .select('*, cavalos(nome), pessoas(nome)')
    .eq('id', id)
    .maybeSingle()

  if (!contrato) notFound()

  const [cavalos, clientes, mensalidades] = await Promise.all([
    cavalosActivos(supabase),
    pessoasActivas(supabase),
    supabase
      .from('mensalidades_penso')
      .select('id, periodo, valor, estado')
      .eq('contrato_id', id)
      .order('periodo', { ascending: false })
      .limit(12),
  ])

  return (
    <>
      <CabecalhoPagina
        titulo={`${contrato.cavalos?.nome ?? 'Contrato'} · ${contrato.pessoas?.nome ?? ''}`}
        descricao={`${formatarEuros(contrato.valor_mensal)} por mês`}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Cartao>
          <ConteudoCartao className="pt-4 sm:pt-5">
            <FormularioEntidade
              accao={guardarContrato}
              id={contrato.id}
              hrefCancelar="/contratos"
              extra={
                <BotaoApagar
                  accao={apagarContrato}
                  id={contrato.id}
                  confirmacao="Apagar este contrato? As mensalidades geradas a partir dele também desaparecem."
                />
              }
            >
              <CamposContrato
                contrato={contrato}
                cavalos={cavalos}
                clientes={clientes}
              />
            </FormularioEntidade>
          </ConteudoCartao>
        </Cartao>

        <Cartao>
          <CabecalhoCartao>
            <TituloCartao>Mensalidades</TituloCartao>
            <DescricaoCartao>
              Últimos 12 meses. Alterar o valor do contrato não muda as
              mensalidades já geradas.
            </DescricaoCartao>
          </CabecalhoCartao>
          <ConteudoCartao className="px-0 sm:px-0">
            {mensalidades.data && mensalidades.data.length > 0 ? (
              <Tabela>
                <Cabecalho>
                  <Linha>
                    <Th>Mês</Th>
                    <Th>Estado</Th>
                    <Th numerico>Valor</Th>
                  </Linha>
                </Cabecalho>
                <Corpo>
                  {mensalidades.data.map((mensalidade) => (
                    <Linha key={mensalidade.id}>
                      <Td>{formatarMesCapitalizado(mensalidade.periodo)}</Td>
                      <Td>
                        <Distintivo
                          cor={
                            mensalidade.estado === 'paga'
                              ? 'sucesso'
                              : mensalidade.estado === 'anulada'
                                ? 'neutro'
                                : 'aviso'
                          }
                        >
                          {ROTULOS_ESTADO_MENSALIDADE[mensalidade.estado]}
                        </Distintivo>
                      </Td>
                      <Td numerico>{formatarEuros(mensalidade.valor)}</Td>
                    </Linha>
                  ))}
                </Corpo>
              </Tabela>
            ) : (
              <SemRegistos
                titulo="Sem mensalidades geradas"
                descricao="Gere-as na página «Pensos do mês»."
              />
            )}
          </ConteudoCartao>
        </Cartao>
      </div>
    </>
  )
}
