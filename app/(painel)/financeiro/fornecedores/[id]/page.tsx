import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirGestao } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposFornecedor } from '@/components/formularios/campos-simples'
import { BotaoApagar } from '@/components/botao-apagar'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  SemRegistos,
  TituloCartao,
} from '@/components/ui/superficie'
import { Corpo, Linha, Tabela, Td } from '@/components/ui/tabela'
import { apagarFornecedor, guardarFornecedor } from '@/lib/accoes/cadastro-diverso'
import { formatarData, formatarEuros } from '@/lib/formatos'

export const metadata: Metadata = { title: 'Fornecedor' }

export default async function PaginaFornecedor({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await exigirGestao()
  const { id } = await params
  const supabase = await criarClienteServidor()

  const [fornecedor, despesas] = await Promise.all([
    supabase.from('fornecedores').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('despesas')
      .select('id, data, descricao, valor_total')
      .eq('fornecedor_id', id)
      .order('data', { ascending: false })
      .limit(10),
  ])

  if (!fornecedor.data) notFound()

  return (
    <>
      <CabecalhoPagina titulo={fornecedor.data.nome} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Cartao>
          <ConteudoCartao className="pt-4 sm:pt-5">
            <FormularioEntidade
              accao={guardarFornecedor}
              id={fornecedor.data.id}
              hrefCancelar="/financeiro/fornecedores"
              extra={
                <BotaoApagar accao={apagarFornecedor} id={fornecedor.data.id} />
              }
            >
              <CamposFornecedor fornecedor={fornecedor.data} />
            </FormularioEntidade>
          </ConteudoCartao>
        </Cartao>

        <Cartao className="h-fit">
          <CabecalhoCartao>
            <TituloCartao>Últimas despesas</TituloCartao>
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
              <SemRegistos titulo="Sem despesas deste fornecedor" />
            )}
          </ConteudoCartao>
        </Cartao>
      </div>
    </>
  )
}
