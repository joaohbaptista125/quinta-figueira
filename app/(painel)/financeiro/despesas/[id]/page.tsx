import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { exigirGestao } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposDespesa } from '@/components/formularios/campos-despesa'
import { BotaoApagar } from '@/components/botao-apagar'
import { LigacaoAnexo } from '@/components/ligacao-anexo'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  TituloCartao,
} from '@/components/ui/superficie'
import { apagarDespesa, guardarDespesa } from '@/lib/accoes/financeiro'
import { cavalosActivos, contasActivas } from '@/lib/consultas'
import { formatarData, formatarEuros } from '@/lib/formatos'

export const metadata: Metadata = { title: 'Despesa' }

export default async function PaginaDespesa({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await exigirGestao()
  const { id } = await params
  const supabase = await criarClienteServidor()

  const { data: despesa } = await supabase
    .from('despesas')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!despesa) notFound()

  const [categorias, fornecedores, contas, cavalos] = await Promise.all([
    supabase.from('categorias_despesa').select('id, nome').order('ordem').order('nome'),
    supabase.from('fornecedores').select('id, nome').order('nome'),
    contasActivas(supabase),
    cavalosActivos(supabase),
  ])

  return (
    <>
      <CabecalhoPagina
        titulo={despesa.descricao}
        descricao={`${formatarData(despesa.data)} · ${formatarEuros(despesa.valor_total)}`}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <Cartao>
          <ConteudoCartao className="pt-4 sm:pt-5">
            <FormularioEntidade
              accao={guardarDespesa}
              id={despesa.id}
              hrefCancelar="/financeiro/despesas"
              extra={<BotaoApagar accao={apagarDespesa} id={despesa.id} />}
            >
              <CamposDespesa
                despesa={despesa}
                categorias={categorias.data ?? []}
                fornecedores={fornecedores.data ?? []}
                contas={contas}
                cavalos={cavalos}
              />
            </FormularioEntidade>
          </ConteudoCartao>
        </Cartao>

        <Cartao className="h-fit">
          <CabecalhoCartao>
            <TituloCartao>Decomposição</TituloCartao>
          </CabecalhoCartao>
          <ConteudoCartao className="space-y-2 text-sm">
            <LinhaValor rotulo="Base tributável" valor={formatarEuros(despesa.valor_base)} />
            <LinhaValor
              rotulo={`IVA (${Number(despesa.taxa_iva)}%)`}
              valor={formatarEuros(despesa.valor_iva)}
            />
            <div className="flex justify-between border-t border-border pt-2 font-medium">
              <span>Total</span>
              <span className="tabular">{formatarEuros(despesa.valor_total)}</span>
            </div>
            {despesa.data_pagamento ? (
              <LinhaValor
                rotulo="Pago em"
                valor={formatarData(despesa.data_pagamento)}
              />
            ) : null}
            <LigacaoAnexo caminho={despesa.anexo_path} />
          </ConteudoCartao>
        </Cartao>
      </div>
    </>
  )
}

function LinhaValor({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{rotulo}</span>
      <span className="tabular">{valor}</span>
    </div>
  )
}
