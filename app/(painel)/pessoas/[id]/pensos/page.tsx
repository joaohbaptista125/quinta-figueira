import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check } from 'lucide-react'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirGestao } from '@/lib/sessao'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { ErroConsulta } from '@/components/erro-consulta'
import { Indicador } from '@/components/indicador'
import {
  ReceberMensalidade,
  ReceberTudo,
} from '@/components/pagamento-penso'
import { classesBotao } from '@/components/ui/botao'
import {
  Aviso,
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
import type { MetodoPagamento } from '@/lib/tipos-bd'

export const metadata: Metadata = { title: 'Conta-corrente' }

/**
 * Conta-corrente de pensos de um cliente.
 *
 * O que já havia era a lista dos pensos de um mês, para todos os clientes. À
 * mesa da cobrança a pergunta é a inversa — «este cliente, o que deve e o que
 * já pagou» — e a resposta obrigava a andar mês a mês. Esta página é essa
 * vista, e traz consigo o recebimento: escolher o método e confirmar, sem
 * passar pelo formulário completo.
 */
export default async function PaginaContaCorrente({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await exigirGestao()
  const { id } = await params
  const supabase = await criarClienteServidor()

  const [pessoa, pensos, recebimentos, contas] = await Promise.all([
    supabase.from('pessoas').select('id, nome').eq('id', id).maybeSingle(),
    supabase
      .from('v_pensos_por_receber')
      .select('*')
      .eq('cliente_id', id)
      .order('periodo', { ascending: false }),
    supabase
      .from('recebimentos')
      .select(
        'id, data, valor, metodo_pagamento, conta_id, mensalidade_id, tipo, periodo, descricao, contas(nome)',
      )
      .eq('pessoa_id', id)
      .order('data', { ascending: false }),
    supabase
      .from('contas')
      .select('id, nome')
      .eq('activa', true)
      .order('nome'),
  ])

  if (pessoa.error) return <ErroConsulta erro={pessoa.error} contexto="o cliente" />
  if (!pessoa.data) notFound()
  if (pensos.error) {
    return <ErroConsulta erro={pensos.error} contexto="a conta-corrente" />
  }

  const linhas = pensos.data ?? []
  const movimentos = recebimentos.data ?? []
  const contasActivas = contas.data ?? []

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
  const totalRecebido = linhas.reduce(
    (soma, linha) => soma + Number(linha.valor_pago),
    0,
  )
  const outros = movimentos.filter((movimento) => !movimento.mensalidade_id)

  // O último pagamento diz quase sempre como será o próximo: quem paga por
  // transferência continua a pagar por transferência.
  const ultimo = movimentos[0]
  const metodoOmissao = (ultimo?.metodo_pagamento ?? 'transferencia') as MetodoPagamento
  const contaOmissao =
    contasActivas.find((conta) => conta.id === ultimo?.conta_id)?.id ??
    contasActivas[0]?.id ??
    ''

  return (
    <>
      <CabecalhoPagina
        voltar={{ href: `/pessoas/${id}`, rotulo: pessoa.data.nome }}
        titulo="Conta-corrente"
        descricao={`Pensos de ${pessoa.data.nome}`}
        accoes={
          <Link
            href={`/financeiro/recebimentos/novo?pessoa=${id}`}
            className={classesBotao('contorno')}
          >
            Outro recebimento
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Indicador
          rotulo="Em dívida"
          valor={formatarEuros(totalEmFalta)}
          detalhe={
            emFalta.length > 0
              ? `${emFalta.length} mês(es) por receber`
              : 'Tudo em dia'
          }
          tom={totalEmFalta > 0 ? 'negativo' : 'positivo'}
        />
        <Indicador
          rotulo="Recebido em pensos"
          valor={formatarEuros(totalRecebido)}
        />
        <Indicador
          rotulo="Mensalidades"
          valor={String(linhas.length)}
          detalhe="Desde o início do contrato"
        />
      </div>

      {contasActivas.length === 0 ? (
        <Aviso tom="atencao" className="mt-4">
          Não há nenhuma conta activa, e um recebimento tem de entrar nalguma.{' '}
          <Link href="/financeiro/contas/nova" className="underline">
            Crie a caixa ou a conta bancária
          </Link>{' '}
          para poder registar pagamentos.
        </Aviso>
      ) : null}

      {totalEmFalta > 0 && contasActivas.length > 0 ? (
        <Cartao className="mt-4">
          <CabecalhoCartao>
            <TituloCartao>Receber</TituloCartao>
            <DescricaoCartao>
              Liquida de uma vez tudo o que está em falta. Para receber só um mês,
              ou parte dele, use o «Registar pagamento» da linha.
            </DescricaoCartao>
          </CabecalhoCartao>
          <ConteudoCartao>
            <ReceberTudo
              mensalidadeIds={emFalta.map((linha) => linha.mensalidade_id)}
              total={totalEmFalta}
              contas={contasActivas}
              contaOmissao={contaOmissao}
              metodoOmissao={metodoOmissao}
            />
          </ConteudoCartao>
        </Cartao>
      ) : null}

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
                const pagamentos =
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

                    {pagamentos.length > 0 ? (
                      <ul className="mt-1.5 space-y-0.5">
                        {pagamentos.map((pagamento) => (
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
                            {pagamento.contas?.nome ? (
                              <>
                                <span>·</span>
                                <span className="truncate">
                                  {pagamento.contas.nome}
                                </span>
                              </>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {falta > 0 && contasActivas.length > 0 ? (
                      <ReceberMensalidade
                        mensalidadeId={linha.mensalidade_id}
                        emFalta={falta}
                        contas={contasActivas}
                        contaOmissao={contaOmissao}
                        metodoOmissao={metodoOmissao}
                      />
                    ) : null}
                  </li>
                )
              })}
            </ol>
          ) : (
            <SemRegistos
              titulo="Sem mensalidades"
              descricao="As mensalidades nascem dos contratos de penso, e são criadas mês a mês em «Pensos do mês»."
              accao={
                <Link href="/financeiro/pensos" className={classesBotao()}>
                  Ir a Pensos do mês
                </Link>
              }
            />
          )}
        </ConteudoCartao>
      </Cartao>

      {outros.length > 0 ? (
        <Cartao className="mt-4">
          <CabecalhoCartao>
            <TituloCartao>Outros recebimentos</TituloCartao>
            <DescricaoCartao>
              Pagamentos deste cliente que não estão imputados a um mês de penso
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
    </>
  )
}
