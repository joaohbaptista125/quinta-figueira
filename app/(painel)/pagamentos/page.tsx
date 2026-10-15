import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirPessoa } from '@/lib/sessao'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { ErroConsulta } from '@/components/erro-consulta'
import { Indicador } from '@/components/indicador'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  Distintivo,
  SemRegistos,
  TituloCartao,
} from '@/components/ui/superficie'
import { ROTULOS_ESTADO_MENSALIDADE, ROTULOS_METODO } from '@/lib/rotulos'
import {
  formatarData,
  formatarEuros,
  formatarMesCapitalizado,
} from '@/lib/formatos'

export const metadata: Metadata = { title: 'Pagamentos' }

/**
 * A conta-corrente vista de quem paga.
 *
 * O cliente tinha a listagem de «Recebimentos» da gestão, que é a mesma
 * pergunta ao contrário: mostrava-lhe uma coluna «Pessoa» com o nome dele
 * repetido em cada linha, dizia-lhe para que conta do centro o dinheiro
 * entrou, e somava o mês corrente — quando quem paga mensalidades quer o ano
 * inteiro, mês a mês.
 *
 * **Quem paga não recebe.** Em todo o lado onde o cliente lê, a palavra é
 * «pagamento»; «recebimento» é a palavra da gestão e fica do lado dela.
 *
 * A RLS já devolveria só o que é do cliente, mas as consultas filtram à mesma
 * pela pessoa da sessão: sem isso, um admin que abrisse esta página via as
 * mensalidades do centro inteiro debaixo do título «o que já pagou». O filtro
 * é por correcção do que se mostra; a protecção continua a ser a RLS.
 */
export default async function PaginaPagamentos() {
  const sessao = await exigirPessoa()
  const supabase = await criarClienteServidor()

  const [pensos, pagamentos] = await Promise.all([
    supabase
      .from('v_pensos_por_receber')
      .select('*')
      .eq('cliente_id', sessao.id)
      .order('periodo', { ascending: false }),
    // Sem `contas(nome)`: para quem paga, a conta do centro onde o dinheiro
    // entrou não é informação — e a RLS também não lha daria.
    supabase
      .from('recebimentos')
      .select('id, data, valor, metodo_pagamento, mensalidade_id, descricao')
      .eq('pessoa_id', sessao.id)
      .order('data', { ascending: false }),
  ])

  if (pensos.error) {
    return <ErroConsulta erro={pensos.error} contexto="os seus pagamentos" />
  }

  const linhas = pensos.data ?? []
  const movimentos = pagamentos.data ?? []

  const pagamentosPorMensalidade = new Map<string, typeof movimentos>()
  for (const movimento of movimentos) {
    if (!movimento.mensalidade_id) continue
    const lista = pagamentosPorMensalidade.get(movimento.mensalidade_id) ?? []
    lista.push(movimento)
    pagamentosPorMensalidade.set(movimento.mensalidade_id, lista)
  }

  const emFalta = linhas.filter((linha) => Number(linha.valor_em_falta) > 0)
  const totalEmFalta = emFalta.reduce(
    (soma, linha) => soma + Number(linha.valor_em_falta),
    0,
  )
  const outros = movimentos.filter((movimento) => !movimento.mensalidade_id)

  return (
    <>
      <CabecalhoPagina
        titulo="Pagamentos"
        descricao={`O que já pagou e o que falta, mês a mês — ${sessao.nome.split(' ')[0]}`}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Indicador
          rotulo="Por pagar"
          valor={formatarEuros(totalEmFalta)}
          tom={totalEmFalta > 0 ? 'negativo' : 'positivo'}
          detalhe={
            emFalta.length > 0
              ? `${emFalta.length === 1 ? '1 mês' : `${emFalta.length} meses`} em falta`
              : 'Tudo em dia'
          }
        />
        <Indicador
          rotulo="Meses de penso"
          valor={String(linhas.length)}
          detalhe="Desde o início do contrato"
        />
      </div>

      <Cartao className="mt-4">
        <CabecalhoCartao>
          <TituloCartao>Mensalidades</TituloCartao>
          <DescricaoCartao>Da mais recente para a mais antiga</DescricaoCartao>
        </CabecalhoCartao>
        <ConteudoCartao className="px-0 sm:px-0">
          {linhas.length > 0 ? (
            <ol className="divide-y divide-border border-t border-border">
              {linhas.map((linha) => {
                const falta = Number(linha.valor_em_falta)
                const recebidos =
                  pagamentosPorMensalidade.get(linha.mensalidade_id) ?? []

                return (
                  <li key={linha.mensalidade_id} className="px-4 py-3 sm:px-5">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-medium">
                        {formatarMesCapitalizado(linha.periodo)}
                      </span>
                      <Distintivo cor={falta > 0 ? 'aviso' : 'sucesso'}>
                        {ROTULOS_ESTADO_MENSALIDADE[linha.estado]}
                      </Distintivo>
                      <span className="tabular ml-auto font-semibold">
                        {formatarEuros(linha.valor)}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {linha.cavalo_nome}
                      {falta > 0
                        ? ` · vence dia ${linha.dia_vencimento} · faltam ${formatarEuros(falta)}`
                        : ''}
                    </p>

                    {recebidos.length > 0 ? (
                      <ul className="mt-1.5 space-y-0.5">
                        {recebidos.map((pagamento) => (
                          <li
                            key={pagamento.id}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground"
                          >
                            <Check
                              className="size-3.5 shrink-0 text-success"
                              aria-hidden
                            />
                            <span className="tabular">
                              {formatarData(pagamento.data)}
                            </span>
                            <span>·</span>
                            <span className="font-medium text-foreground">
                              {ROTULOS_METODO[pagamento.metodo_pagamento]}
                            </span>
                            <span>·</span>
                            <span className="tabular">
                              {formatarEuros(pagamento.valor)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                )
              })}
            </ol>
          ) : (
            <SemRegistos
              titulo="Ainda não há mensalidades"
              descricao="As mensalidades nascem do contrato de penso do seu cavalo. Se isto não está certo, fale com a gestão do centro."
            />
          )}
        </ConteudoCartao>
      </Cartao>

      {outros.length > 0 ? (
        <Cartao className="mt-4">
          <CabecalhoCartao>
            <TituloCartao>Outros pagamentos</TituloCartao>
            <DescricaoCartao>
              O que pagou fora das mensalidades de penso
            </DescricaoCartao>
          </CabecalhoCartao>
          <ConteudoCartao className="px-0 sm:px-0">
            <ul className="divide-y divide-border border-t border-border">
              {outros.map((movimento) => (
                <li
                  key={movimento.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-sm sm:px-5"
                >
                  <span className="tabular text-muted-foreground">
                    {formatarData(movimento.data)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {movimento.descricao ?? '—'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {ROTULOS_METODO[movimento.metodo_pagamento]}
                  </span>
                  <span className="tabular font-medium">
                    {formatarEuros(movimento.valor)}
                  </span>
                </li>
              ))}
            </ul>
          </ConteudoCartao>
        </Cartao>
      ) : null}

      <p className="mt-4 text-xs text-muted-foreground">
        Este é o registo interno do centro e não substitui a factura ou o recibo
        emitidos pela contabilidade.
      </p>
    </>
  )
}
