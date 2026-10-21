import Link from 'next/link'
import { HandCoins, TriangleAlert } from 'lucide-react'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  Distintivo,
  TituloCartao,
} from '@/components/ui/superficie'
import { ConfirmarPagamento } from '@/components/confirmar-pagamento'
import { ROTULOS_METODO } from '@/lib/rotulos'
import {
  formatarData,
  formatarDataHora,
  formatarEuros,
  formatarMesCapitalizado,
} from '@/lib/formatos'

/**
 * Os pagamentos que os clientes dizem ter feito, à espera de confirmação.
 *
 * É a metade de dentro do «Já paguei». Sem este cartão, uma declaração ficava
 * à espera que alguém por acaso lá fosse — e o cliente ficava convencido de
 * que tinha avisado o centro, o que é pior do que não ter avisado.
 *
 * Não aparece quando não há nada: um cartão vazio todos os dias ensina a não
 * olhar para ele.
 *
 * O que a gestão compara aqui é uma linha só: **o que a pessoa diz ter pago
 * contra o que falta mesmo desse mês.** Quando os dois números não batem, ou
 * quando o item já foi anulado, o cartão di-lo antes de haver um botão para
 * carregar.
 */
export async function PagamentosPorConfirmar({
  compacto = false,
  pessoaId,
}: {
  /** No painel mostra só a contagem e o caminho; a decisão faz-se no financeiro. */
  compacto?: boolean
  /** Na ficha de um cliente, só as dele. */
  pessoaId?: string
}) {
  const supabase = await criarClienteServidor()

  const consulta = supabase
    .from('v_pagamentos_por_confirmar')
    .select('*')
    .order('criado_em', { ascending: true })

  const [declaracoes, contas] = await Promise.all([
    pessoaId ? consulta.eq('pessoa_id', pessoaId) : consulta,
    supabase.from('contas').select('id, nome').eq('activa', true).order('nome'),
  ])

  const lista = declaracoes.data ?? []
  if (lista.length === 0) return null

  const total = lista.reduce((soma, linha) => soma + Number(linha.valor), 0)
  const contasActivas = contas.data ?? []

  const titulo =
    lista.length === 1
      ? '1 pagamento por confirmar'
      : `${lista.length} pagamentos por confirmar`

  if (compacto) {
    return (
      <Cartao className="mt-4">
        <CabecalhoCartao>
          <TituloCartao className="flex items-center gap-2">
            <HandCoins className="size-4 text-warning-foreground" aria-hidden />
            {titulo}
          </TituloCartao>
          <DescricaoCartao>
            {formatarEuros(total)} que {lista.length === 1 ? 'um cliente diz' : 'os clientes dizem'}{' '}
            ter pago, e que ainda não está registado.{' '}
            <Link href="/financeiro/por-receber" className="underline">
              Confirmar no financeiro
            </Link>
            .
          </DescricaoCartao>
        </CabecalhoCartao>
      </Cartao>
    )
  }

  return (
    <Cartao className="my-4">
      <CabecalhoCartao>
        <TituloCartao className="flex items-center gap-2">
          <HandCoins className="size-4 text-warning-foreground" aria-hidden />
          {titulo}
        </TituloCartao>
        <DescricaoCartao>
          O que os clientes dizem ter pago — {formatarEuros(total)} ao todo.
          Nada disto está registado: o dinheiro só entra na conta quando
          confirmar, e o valor que fica é o que confirmar aqui.
        </DescricaoCartao>
      </CabecalhoCartao>
      <ConteudoCartao className="px-0 sm:px-0">
        <ul className="divide-y divide-border border-t border-border">
          {lista.map((linha) => {
            const falta = linha.valor_em_falta
            const declarado = Number(linha.valor)
            const bate = falta != null && Number(falta) === declarado

            return (
              <li key={linha.declaracao_id} className="space-y-3 px-4 py-4 sm:px-5">
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <Link
                      href={`/pessoas/${linha.pessoa_id}/pensos`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {linha.pessoa_nome}
                    </Link>
                    <Distintivo cor="neutro">
                      {ROTULOS_METODO[linha.metodo_pagamento]}
                    </Distintivo>
                    <span className="tabular ml-auto text-lg font-semibold">
                      {formatarEuros(declarado)}
                    </span>
                  </div>

                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {linha.respeita_a === 'penso' && linha.periodo
                      ? `Penso de ${formatarMesCapitalizado(linha.periodo)}`
                      : (linha.encargo_descricao ?? 'Encargo')}
                    {linha.cavalo_nome ? ` · ${linha.cavalo_nome}` : ''}
                    {` · diz ter pago a ${formatarData(linha.data)}`}
                  </p>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Avisou {formatarDataHora(linha.criado_em)}
                    {linha.pessoa_telefone ? ` · ${linha.pessoa_telefone}` : ''}
                    {linha.referencia ? ` · ref. ${linha.referencia}` : ''}
                  </p>
                </div>

                {falta == null ? (
                  <p className="flex items-start gap-1.5 text-sm text-destructive">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    O mês ou encargo a que isto respeitava já não existe, ou foi
                    anulado. Confirme antes de registar.
                  </p>
                ) : !bate ? (
                  <p className="flex items-start gap-1.5 text-sm text-warning-foreground">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    Diz ter pago {formatarEuros(declarado)}, e em falta estão{' '}
                    {formatarEuros(falta)}. Corrija o valor antes de confirmar,
                    se for caso disso.
                  </p>
                ) : null}

                <ConfirmarPagamento
                  declaracaoId={linha.declaracao_id}
                  valor={declarado}
                  data={linha.data}
                  metodo={linha.metodo_pagamento}
                  contas={contasActivas}
                  contaOmissao={contasActivas[0]?.id ?? ''}
                />
              </li>
            )
          })}
        </ul>
      </ConteudoCartao>
    </Cartao>
  )
}
