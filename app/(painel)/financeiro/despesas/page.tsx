import type { Metadata } from 'next'
import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirGestao } from '@/lib/sessao'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { SelectorMes } from '@/components/selector-mes'
import { Pesquisa } from '@/components/pesquisa'
import { FiltroPastilhas } from '@/components/filtros'
import { Indicador } from '@/components/indicador'
import { classesBotao } from '@/components/ui/botao'
import { Cartao, Distintivo, SemRegistos } from '@/components/ui/superficie'
import {
  Cabecalho,
  Corpo,
  LigacaoFicha,
  Linha,
  Tabela,
  Td,
  Th,
} from '@/components/ui/tabela'
import { BotaoMarcarPaga } from '@/components/botao-marcar-paga'
import { ROTULOS_METODO } from '@/lib/rotulos'
import {
  deslocarMeses,
  formatarData,
  formatarEuros,
  primeiroDiaDoMes,
} from '@/lib/formatos'

export const metadata: Metadata = { title: 'Despesas' }

export default async function PaginaDespesas({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; estado?: string; q?: string }>
}) {
  await exigirGestao()
  const { mes, estado, q } = await searchParams
  const periodo = mes ? primeiroDiaDoMes(`${mes}-01`) : primeiroDiaDoMes()
  const fim = deslocarMeses(periodo, 1)
  const supabase = await criarClienteServidor()

  /*
   * **Procurar sai do mês, e isso é a decisão que importa aqui.**
   *
   * Quem escreve «veterinário» na caixa não sabe de que mês era a factura —
   * se soubesse, mudava o mês e olhava. Uma pesquisa presa ao mês escolhido
   * respondia quase sempre «nada encontrado» sobre uma despesa que existe, e
   * é a pior resposta que uma pesquisa pode dar. É o mesmo raciocínio de
   * `/financeiro/por-receber`, que deixou de mostrar um mês de cada vez.
   *
   * O selector de mês continua lá, mas fica a dizer que não está a mandar.
   */
  const termo = q?.trim() ?? ''
  const aProcurar = termo.length > 0

  let consulta = supabase
    .from('despesas')
    .select(
      'id, data, descricao, valor_total, valor_base, valor_iva, taxa_iva, metodo_pagamento, paga, anexo_path, categorias_despesa(nome), fornecedores(nome), contas(nome), cavalos(id, nome)',
    )
    .order('data', { ascending: false })

  if (aProcurar) {
    // Um fornecedor é outra tabela: vão-se buscar os ids que batem certo e
    // juntam-se à condição. Um `!inner` filtrava fora as despesas sem
    // fornecedor, que são muitas (combustível, pequenas compras).
    const { data: fornecedores } = await supabase
      .from('fornecedores')
      .select('id')
      .ilike('nome', `%${termo}%`)

    const ids = (fornecedores ?? []).map((linha) => linha.id)
    const condicoes = [`descricao.ilike.%${termo}%`]
    // `in.()` com a lista vazia é sintaxe inválida no PostgREST.
    if (ids.length > 0) condicoes.push(`fornecedor_id.in.(${ids.join(',')})`)

    consulta = consulta.or(condicoes.join(',')).limit(100)
  } else {
    consulta = consulta.gte('data', periodo).lt('data', fim)
  }

  if (estado === 'por-pagar') consulta = consulta.eq('paga', false)

  const { data: despesas, error } = await consulta

  const total = (despesas ?? []).reduce(
    (soma, despesa) => soma + Number(despesa.valor_total),
    0,
  )
  const porPagar = (despesas ?? [])
    .filter((despesa) => !despesa.paga)
    .reduce((soma, despesa) => soma + Number(despesa.valor_total), 0)
  const iva = (despesas ?? []).reduce(
    (soma, despesa) => soma + Number(despesa.valor_iva),
    0,
  )

  return (
    <>
      <CabecalhoPagina
        titulo="Despesas"
        descricao="Registo do que o centro gasta e de que conta sai"
        accoes={
          <>
            <SelectorMes periodo={periodo} />
            <Link href="/financeiro/despesas/nova" className={classesBotao()}>
              Lançar despesa
            </Link>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {/* O rótulo muda a procurar — ver o mesmo em recebimentos. */}
        <Indicador
          rotulo={aProcurar ? 'Total encontrado' : 'Total do mês'}
          valor={formatarEuros(total)}
        />
        <Indicador
          rotulo="Por pagar"
          valor={formatarEuros(porPagar)}
          tom={porPagar > 0 ? 'negativo' : 'neutro'}
        />
        <Indicador rotulo="IVA suportado" valor={formatarEuros(iva)} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Pesquisa placeholder="Pesquisar por descrição ou fornecedor" />
        <FiltroPastilhas
          rotulo="Estado"
          parametro="estado"
          opcoes={[
            { rotulo: 'Todas' },
            { valor: 'por-pagar', rotulo: 'Por pagar' },
          ]}
        />
      </div>

      {aProcurar ? (
        <p className="mb-4 text-sm text-muted-foreground">
          A procurar em <strong>todos os meses</strong>, e não só no mês
          escolhido. Até 100 resultados, dos mais recentes para trás.
        </p>
      ) : null}

      <Cartao>
        {error ? (
          <SemRegistos titulo="Não foi possível carregar" descricao={error.message} />
        ) : despesas && despesas.length > 0 ? (
          <Tabela>
            <Cabecalho>
              <Linha>
                <Th>Data</Th>
                <Th>Descrição</Th>
                <Th>Categoria</Th>
                <Th>Pagamento</Th>
                <Th numerico>Valor</Th>
                <Th />
              </Linha>
            </Cabecalho>
            <Corpo>
              {despesas.map((despesa) => (
                <Linha key={despesa.id}>
                  <Td rotulo="Data" className="whitespace-nowrap text-muted-foreground">
                    {formatarData(despesa.data)}
                  </Td>
                  <Td>
                    <LigacaoFicha href={`/financeiro/despesas/${despesa.id}`}>{despesa.descricao}</LigacaoFicha>
                    <div className="text-xs text-muted-foreground">
                      {despesa.fornecedores?.nome ?? 'Sem fornecedor'}
                      {despesa.cavalos ? ` · ${despesa.cavalos.nome}` : ''}
                      {despesa.anexo_path ? ' · com fatura' : ''}
                    </div>
                  </Td>
                  <Td rotulo="Categoria" className="text-muted-foreground">
                    {despesa.categorias_despesa?.nome ?? '—'}
                  </Td>
                  <Td rotulo="Pagamento" className="text-muted-foreground">
                    <div className="text-xs">
                      {ROTULOS_METODO[despesa.metodo_pagamento]}
                      <br />
                      {despesa.contas?.nome ?? '—'}
                    </div>
                  </Td>
                  <Td rotulo="Valor" numerico className="font-medium">
                    {formatarEuros(despesa.valor_total)}
                    <div className="text-xs font-normal text-muted-foreground">
                      IVA {formatarEuros(despesa.valor_iva)}
                    </div>
                  </Td>
                  <Td>
                    {despesa.paga ? (
                      <Distintivo cor="sucesso">Paga</Distintivo>
                    ) : (
                      <BotaoMarcarPaga id={despesa.id} />
                    )}
                  </Td>
                </Linha>
              ))}
            </Corpo>
          </Tabela>
        ) : (
          <SemRegistos
            titulo="Sem despesas neste mês"
            accao={
              <Link href="/financeiro/despesas/nova" className={classesBotao()}>
                Lançar despesa
              </Link>
            }
          />
        )}
      </Cartao>
    </>
  )
}
