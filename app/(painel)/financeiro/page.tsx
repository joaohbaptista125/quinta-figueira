import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Banknote, Receipt } from 'lucide-react'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirGestao } from '@/lib/sessao'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
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
import { Cabecalho, Corpo, Linha, Tabela, Td, Th } from '@/components/ui/tabela'
import {
  formatarEuros,
  formatarMesCapitalizado,
  primeiroDiaDoMes,
} from '@/lib/formatos'

export const metadata: Metadata = { title: 'Financeiro' }

/**
 * A porta do financeiro.
 *
 * A secção tinha seis entradas de menu e nenhuma delas dizia por onde começar:
 * «Contas» eram os bancos do centro, «conta-corrente» era o que um cliente
 * deve, e havia três sítios diferentes a mostrar dinheiro a entrar. Esta
 * página reduz tudo a **duas perguntas** — quem me deve, o que gastei — e
 * manda para o sítio onde cada uma se responde.
 *
 * O aviso em cima não é decoração: é o contrato desta secção. A aplicação não
 * liga a nenhum banco e não movimenta dinheiro nenhum; o que aqui está é o que
 * alguém lançou à mão, e serve para conferir contra o extracto.
 */
export default async function PaginaFinanceiro() {
  await exigirGestao()
  const periodo = primeiroDiaDoMes()
  const supabase = await criarClienteServidor()

  const [pensos, encargos, resumo, saldos] = await Promise.all([
    supabase
      .from('v_pensos_por_receber')
      .select('cliente_id, valor_em_falta')
      .gt('valor_em_falta', 0),
    supabase
      .from('v_encargos_por_receber')
      .select('pessoa_id, valor_em_falta')
      .neq('estado', 'anulado')
      .gt('valor_em_falta', 0),
    supabase.from('v_resumo_mensal').select('*').eq('periodo', periodo).maybeSingle(),
    supabase.from('v_saldos_contas').select('*').eq('activa', true).order('nome'),
  ])

  const linhasPensos = pensos.data ?? []
  const linhasEncargos = encargos.data ?? []

  const emDivida =
    linhasPensos.reduce((soma, linha) => soma + Number(linha.valor_em_falta), 0) +
    linhasEncargos.reduce((soma, linha) => soma + Number(linha.valor_em_falta), 0)

  const devedores = new Set([
    ...linhasPensos.map((linha) => linha.cliente_id),
    ...linhasEncargos.map((linha) => linha.pessoa_id),
  ])

  const despesas = Number(resumo.data?.total_despesas ?? 0)
  const despesasPagas = Number(resumo.data?.total_despesas_pagas ?? 0)
  const recebido = Number(resumo.data?.total_recebimentos ?? 0)
  const porPagar = despesas - despesasPagas

  const contas = saldos.data ?? []
  const saldoTotal = contas.reduce(
    (soma, conta) => soma + Number(conta.saldo_actual),
    0,
  )

  return (
    <>
      <CabecalhoPagina
        titulo="Financeiro"
        descricao={`${formatarMesCapitalizado(periodo)} · duas perguntas: quem me deve, e o que gastei`}
      />

      <Aviso className="mb-4">
        <strong>Isto é um livro de registo.</strong> A aplicação não está ligada
        a nenhum banco e não movimenta dinheiro nenhum: tudo o que aqui aparece
        foi lançado à mão por alguém, e serve para conferir contra o extracto —
        não para o substituir.
      </Aviso>

      <div className="grid gap-4 md:grid-cols-2">
        <Porta
          href="/financeiro/por-receber"
          Icone={Banknote}
          titulo="Quem me deve"
          valor={formatarEuros(emDivida)}
          tom={emDivida > 0 ? 'negativo' : 'positivo'}
          detalhe={
            devedores.size === 0
              ? 'Ninguém com valores em falta'
              : `${devedores.size} cliente${devedores.size === 1 ? '' : 's'} · pensos e encargos, de todos os meses`
          }
          accao="Ver quem deve"
        />

        <Porta
          href="/financeiro/despesas"
          Icone={Receipt}
          titulo="O que gastei"
          valor={formatarEuros(despesas)}
          tom="neutro"
          detalhe={
            porPagar > 0
              ? `${formatarEuros(porPagar)} ainda por pagar · ${formatarMesCapitalizado(periodo).toLowerCase()}`
              : `Tudo pago · ${formatarMesCapitalizado(periodo).toLowerCase()}`
          }
          accao="Ver despesas"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Cartao>
          <CabecalhoCartao className="flex flex-row items-start justify-between gap-2">
            <div>
              <TituloCartao>Caixa e bancos</TituloCartao>
              <DescricaoCartao>
                Saldo inicial mais o que foi lançado aqui — {formatarEuros(saldoTotal)}{' '}
                no total das contas activas
              </DescricaoCartao>
            </div>
            <Link
              href="/financeiro/contas"
              className={classesBotao('contorno', 'pequeno')}
            >
              Ver contas
            </Link>
          </CabecalhoCartao>
          <ConteudoCartao className="px-0 sm:px-0">
            {contas.length > 0 ? (
              <Tabela>
                <Cabecalho>
                  <Linha>
                    <Th>Conta</Th>
                    <Th numerico>Saldo registado</Th>
                  </Linha>
                </Cabecalho>
                <Corpo>
                  {contas.map((conta) => (
                    <Linha key={conta.id}>
                      <Td>
                        <span className="font-medium">{conta.nome}</span>{' '}
                        <Distintivo cor="neutro" className="ml-1">
                          {conta.tipo === 'caixa' ? 'Caixa' : 'Banco'}
                        </Distintivo>
                      </Td>
                      <Td
                        rotulo="Saldo registado"
                        numerico
                        className={
                          Number(conta.saldo_actual) < 0
                            ? 'font-medium text-destructive'
                            : 'font-medium'
                        }
                      >
                        {formatarEuros(conta.saldo_actual)}
                      </Td>
                    </Linha>
                  ))}
                </Corpo>
              </Tabela>
            ) : (
              <SemRegistos
                titulo="Ainda não há contas"
                descricao="Crie pelo menos a caixa em dinheiro e a conta bancária principal — um recebimento tem de entrar nalguma."
                accao={
                  <Link href="/financeiro/contas/nova" className={classesBotao()}>
                    Criar conta
                  </Link>
                }
              />
            )}
          </ConteudoCartao>
        </Cartao>

        <Cartao>
          <CabecalhoCartao>
            <TituloCartao>Lançar</TituloCartao>
            <DescricaoCartao>
              O dinheiro que já entrou ou saiu. Um recebimento de pensos faz-se
              melhor na conta-corrente do cliente, a partir de «Quem me deve».
            </DescricaoCartao>
          </CabecalhoCartao>
          <ConteudoCartao className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Link href="/financeiro/despesas/nova" className={classesBotao()}>
                Lançar despesa
              </Link>
              <Link
                href="/financeiro/recebimentos/novo"
                className={classesBotao('contorno')}
              >
                Registar recebimento
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              Recebido este mês: <strong>{formatarEuros(recebido)}</strong>. Vê
              tudo em{' '}
              <Link href="/financeiro/recebimentos" className="underline">
                recebimentos
              </Link>
              ; as despesas lançadas estão em{' '}
              <Link href="/financeiro/despesas" className="underline">
                despesas
              </Link>
              .
            </p>
            <p className="border-t border-border pt-3 text-sm text-muted-foreground">
              Fornecedores e categorias de despesa são listas de apoio e vivem
              nas{' '}
              <Link href="/financeiro/definicoes" className="underline">
                definições do financeiro
              </Link>
              .
            </p>
          </ConteudoCartao>
        </Cartao>
      </div>
    </>
  )
}

/** Uma das duas perguntas, em grande, com o caminho para a resposta. */
function Porta({
  href,
  Icone,
  titulo,
  valor,
  detalhe,
  tom,
  accao,
}: {
  href: string
  Icone: React.ComponentType<{ className?: string }>
  titulo: string
  valor: string
  detalhe: string
  tom: 'neutro' | 'positivo' | 'negativo'
  accao: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Cartao className="h-full p-5 transition-colors group-hover:bg-accent">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icone className="size-4" aria-hidden />
          {titulo}
        </div>
        <p
          className={
            tom === 'negativo'
              ? 'tabular mt-2 text-3xl font-semibold tracking-tight text-destructive'
              : tom === 'positivo'
                ? 'tabular mt-2 text-3xl font-semibold tracking-tight text-success'
                : 'tabular mt-2 text-3xl font-semibold tracking-tight'
          }
        >
          {valor}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{detalhe}</p>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium">
          {accao}
          <ArrowRight className="size-4" aria-hidden />
        </span>
      </Cartao>
    </Link>
  )
}
