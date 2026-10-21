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
import {
  DeclararPagamento,
  type DeclaracaoDoItem,
} from '@/components/declarar-pagamento'
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

  const [pensos, pagamentos, encargos, declaracoes] = await Promise.all([
    supabase
      .from('v_pensos_por_receber')
      .select('*')
      .eq('cliente_id', sessao.id)
      .order('periodo', { ascending: false }),
    // Sem `contas(nome)`: para quem paga, a conta do centro onde o dinheiro
    // entrou não é informação — e a RLS também não lha daria.
    supabase
      .from('recebimentos')
      .select('id, data, valor, metodo_pagamento, mensalidade_id, encargo_id, descricao')
      .eq('pessoa_id', sessao.id)
      .order('data', { ascending: false }),
    // Ferração, veterinário, transporte: o que o centro adiantou e recobra.
    supabase
      .from('v_encargos_por_receber')
      .select('*')
      .eq('pessoa_id', sessao.id)
      .neq('estado', 'anulado')
      .order('data', { ascending: false }),
    // «Já paguei»: o que esta pessoa avisou e ainda não foi confirmado, ou foi
    // recusado. A RLS já devolvia só as dela; o filtro é pela mesma razão das
    // outras consultas desta página.
    supabase
      .from('pagamentos_declarados')
      .select(
        'id, mensalidade_id, encargo_id, valor, data, metodo_pagamento, referencia, estado, motivo',
      )
      .eq('pessoa_id', sessao.id)
      .neq('estado', 'confirmada')
      .order('criado_em', { ascending: false }),
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
  // Os pagamentos de encargos já aparecem na linha do encargo; aqui ficam os
  // que não respeitam a nada em particular.
  const outros = movimentos.filter(
    (movimento) => !movimento.mensalidade_id && !movimento.encargo_id,
  )

  // A mais recente de cada item: uma pendente é única por construção (índice
  // único na base), mas recusadas pode haver várias ao longo do tempo.
  const declaracaoPorMensalidade = new Map<string, DeclaracaoDoItem>()
  const declaracaoPorEncargo = new Map<string, DeclaracaoDoItem>()
  for (const linha of declaracoes.data ?? []) {
    const alvo: DeclaracaoDoItem = {
      id: linha.id,
      valor: Number(linha.valor),
      data: linha.data,
      metodo_pagamento: linha.metodo_pagamento,
      referencia: linha.referencia,
      estado: linha.estado as DeclaracaoDoItem['estado'],
      motivo: linha.motivo,
    }
    if (linha.mensalidade_id && !declaracaoPorMensalidade.has(linha.mensalidade_id)) {
      declaracaoPorMensalidade.set(linha.mensalidade_id, alvo)
    }
    if (linha.encargo_id && !declaracaoPorEncargo.has(linha.encargo_id)) {
      declaracaoPorEncargo.set(linha.encargo_id, alvo)
    }
  }

  // O último método usado diz quase sempre como será o próximo.
  const metodoOmissao = movimentos[0]?.metodo_pagamento ?? 'transferencia'

  const linhasEncargos = encargos.data ?? []
  const encargosPorPagar = linhasEncargos.filter(
    (linha) => Number(linha.valor_em_falta) > 0,
  )
  const totalEncargos = encargosPorPagar.reduce(
    (soma, linha) => soma + Number(linha.valor_em_falta),
    0,
  )

  return (
    <>
      <CabecalhoPagina
        titulo="Pagamentos"
        descricao={`O que já pagou e o que falta, mês a mês — ${sessao.nome.split(' ')[0]}`}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Indicador
          rotulo="Por pagar"
          valor={formatarEuros(totalEmFalta + totalEncargos)}
          tom={totalEmFalta + totalEncargos > 0 ? 'negativo' : 'positivo'}
          detalhe={
            emFalta.length > 0 || encargosPorPagar.length > 0
              ? [
                  emFalta.length > 0
                    ? `${emFalta.length === 1 ? '1 mês' : `${emFalta.length} meses`} de penso`
                    : null,
                  encargosPorPagar.length > 0
                    ? `${encargosPorPagar.length === 1 ? '1 encargo' : `${encargosPorPagar.length} encargos`}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
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

                    {falta > 0 ? (
                      <DeclararPagamento
                        mensalidadeId={linha.mensalidade_id}
                        emFalta={falta}
                        declaracao={declaracaoPorMensalidade.get(linha.mensalidade_id)}
                        metodoOmissao={metodoOmissao}
                      />
                    ) : null}

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

      {linhasEncargos.length > 0 ? (
        <Cartao className="mt-4">
          <CabecalhoCartao>
            <TituloCartao>Ferração e outros encargos</TituloCartao>
            <DescricaoCartao>
              O que o centro adiantou por si e lhe cobra à parte da mensalidade
            </DescricaoCartao>
          </CabecalhoCartao>
          <ConteudoCartao className="px-0 sm:px-0">
            <ol className="divide-y divide-border border-t border-border">
              {linhasEncargos.map((linha) => {
                const falta = Number(linha.valor_em_falta)
                return (
                  <li key={linha.encargo_id} className="px-4 py-3 sm:px-5">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-medium">{linha.descricao}</span>
                      <Distintivo cor={falta > 0 ? 'aviso' : 'sucesso'}>
                        {falta > 0 ? 'Por pagar' : 'Pago'}
                      </Distintivo>
                      <span className="tabular ml-auto font-semibold">
                        {formatarEuros(linha.valor)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatarData(linha.data)}
                      {linha.cavalo_nome ? ` · ${linha.cavalo_nome}` : ''}
                      {falta > 0 && falta !== Number(linha.valor)
                        ? ` · faltam ${formatarEuros(falta)}`
                        : ''}
                    </p>

                    {falta > 0 ? (
                      <DeclararPagamento
                        encargoId={linha.encargo_id}
                        emFalta={falta}
                        declaracao={declaracaoPorEncargo.get(linha.encargo_id)}
                        metodoOmissao={metodoOmissao}
                      />
                    ) : null}
                  </li>
                )
              })}
            </ol>
          </ConteudoCartao>
        </Cartao>
      ) : null}

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
