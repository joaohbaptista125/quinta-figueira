import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { Indicador } from '@/components/indicador'
import { SelectorMes } from '@/components/selector-mes'
import { classesBotao } from '@/components/ui/botao'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  Distintivo,
  SemRegistos,
  TituloCartao,
} from '@/components/ui/superficie'
import { Corpo, Linha, Tabela, Td, Th, Cabecalho } from '@/components/ui/tabela'
import { formatarData, formatarEuros, formatarMesCapitalizado } from '@/lib/formatos'
import { deslocarMeses } from '@/lib/formatos'

export async function PainelGestao({
  periodo,
  nome,
}: {
  periodo: string
  nome: string
}) {
  const supabase = await criarClienteServidor()
  const fimDoMes = deslocarMeses(periodo, 1)

  const [resumo, saldos, porCategoria, pensos, ultimasDespesas] =
    await Promise.all([
      supabase
        .from('v_resumo_mensal')
        .select('*')
        .eq('periodo', periodo)
        .maybeSingle(),
      supabase
        .from('v_saldos_contas')
        .select('*')
        .eq('activa', true)
        .order('nome'),
      supabase
        .from('v_despesas_por_categoria')
        .select('*')
        .eq('periodo', periodo)
        .order('total', { ascending: false }),
      supabase
        .from('v_pensos_por_receber')
        .select('*')
        .eq('periodo', periodo)
        .neq('estado', 'paga')
        .order('cliente_nome'),
      supabase
        .from('despesas')
        .select('id, data, descricao, valor_total, paga, categorias_despesa(nome)')
        .gte('data', periodo)
        .lt('data', fimDoMes)
        .order('data', { ascending: false })
        .limit(6),
    ])

  const receitas = resumo.data?.total_recebimentos ?? 0
  const despesas = resumo.data?.total_despesas ?? 0
  const despesasPagas = resumo.data?.total_despesas_pagas ?? 0
  const resultado = receitas - despesas
  const porPagar = despesas - despesasPagas

  const categorias = porCategoria.data ?? []
  const maiorCategoria = categorias[0]?.total ?? 0
  const totalEmFalta = (pensos.data ?? []).reduce(
    (soma, linha) => soma + Number(linha.valor_em_falta),
    0,
  )

  return (
    <>
      <CabecalhoPagina
        titulo={`Olá, ${nome.split(' ')[0]}`}
        descricao={formatarMesCapitalizado(periodo)}
        accoes={<SelectorMes periodo={periodo} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          rotulo="Receitas do mês"
          valor={formatarEuros(receitas)}
          tom="positivo"
        />
        <Indicador
          rotulo="Despesas do mês"
          valor={formatarEuros(despesas)}
          detalhe={
            porPagar > 0 ? `${formatarEuros(porPagar)} ainda por pagar` : undefined
          }
          tom="negativo"
        />
        <Indicador
          rotulo="Resultado"
          valor={formatarEuros(resultado)}
          tom={resultado >= 0 ? 'positivo' : 'negativo'}
        />
        <Indicador
          rotulo="Pensos por receber"
          valor={formatarEuros(totalEmFalta)}
          detalhe={`${pensos.data?.length ?? 0} mensalidade(s)`}
          tom={totalEmFalta > 0 ? 'negativo' : 'positivo'}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Cartao>
          <CabecalhoCartao className="flex flex-row items-start justify-between gap-2">
            <div>
              <TituloCartao>Pensos por receber</TituloCartao>
              <DescricaoCartao>
                Mensalidades de {formatarMesCapitalizado(periodo).toLowerCase()}{' '}
                ainda em falta
              </DescricaoCartao>
            </div>
            <Link
              href={`/financeiro/pensos?mes=${periodo.slice(0, 7)}`}
              className={classesBotao('contorno', 'pequeno')}
            >
              Ver todos
            </Link>
          </CabecalhoCartao>
          <ConteudoCartao className="px-0 sm:px-0">
            {pensos.data && pensos.data.length > 0 ? (
              <Tabela>
                <Cabecalho>
                  <Linha>
                    <Th>Cliente</Th>
                    <Th>Cavalo</Th>
                    <Th numerico>Em falta</Th>
                  </Linha>
                </Cabecalho>
                <Corpo>
                  {pensos.data.map((linha) => (
                    <Linha key={linha.mensalidade_id}>
                      <Td>
                        <Link
                          href={`/pessoas/${linha.cliente_id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {linha.cliente_nome}
                        </Link>
                      </Td>
                      <Td className="text-muted-foreground">
                        {linha.cavalo_nome}
                      </Td>
                      <Td numerico className="font-medium">
                        {formatarEuros(linha.valor_em_falta)}
                      </Td>
                    </Linha>
                  ))}
                </Corpo>
              </Tabela>
            ) : (
              <SemRegistos
                titulo="Nenhum penso em falta"
                descricao="Todas as mensalidades geradas para este mês estão pagas. Se faltarem contratos, gere as mensalidades na página Pensos do mês."
              />
            )}
          </ConteudoCartao>
        </Cartao>

        <Cartao>
          <CabecalhoCartao>
            <TituloCartao>Saldo por conta</TituloCartao>
            <DescricaoCartao>
              Saldo inicial mais recebimentos, menos despesas já pagas
            </DescricaoCartao>
          </CabecalhoCartao>
          <ConteudoCartao className="px-0 sm:px-0">
            {saldos.data && saldos.data.length > 0 ? (
              <Tabela>
                <Cabecalho>
                  <Linha>
                    <Th>Conta</Th>
                    <Th numerico>Saldo</Th>
                  </Linha>
                </Cabecalho>
                <Corpo>
                  {saldos.data.map((conta) => (
                    <Linha key={conta.id}>
                      <Td>
                        <span className="font-medium">{conta.nome}</span>{' '}
                        <Distintivo cor="neutro" className="ml-1">
                          {conta.tipo === 'caixa' ? 'Caixa' : 'Banco'}
                        </Distintivo>
                      </Td>
                      <Td
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
                descricao="Crie a caixa e as contas bancárias para começar a registar movimentos."
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
            <TituloCartao>Despesa por categoria</TituloCartao>
            <DescricaoCartao>
              {formatarMesCapitalizado(periodo)}
            </DescricaoCartao>
          </CabecalhoCartao>
          <ConteudoCartao>
            {categorias.length > 0 ? (
              <ul className="space-y-2.5">
                {categorias.map((linha) => (
                  <li key={linha.categoria_id}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span>{linha.categoria_nome}</span>
                      <span className="tabular font-medium">
                        {formatarEuros(linha.total)}
                      </span>
                    </div>
                    <div
                      className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
                      role="presentation"
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${maiorCategoria > 0 ? (Number(linha.total) / Number(maiorCategoria)) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <SemRegistos
                titulo="Sem despesas neste mês"
                accao={
                  <Link
                    href="/financeiro/despesas/nova"
                    className={classesBotao()}
                  >
                    Lançar despesa
                  </Link>
                }
              />
            )}
          </ConteudoCartao>
        </Cartao>

        <Cartao>
          <CabecalhoCartao className="flex flex-row items-start justify-between gap-2">
            <div>
              <TituloCartao>Últimas despesas</TituloCartao>
              <DescricaoCartao>Lançamentos mais recentes do mês</DescricaoCartao>
            </div>
            <Link
              href="/financeiro/despesas/nova"
              className={classesBotao('primario', 'pequeno')}
            >
              Lançar despesa
            </Link>
          </CabecalhoCartao>
          <ConteudoCartao className="px-0 sm:px-0">
            {ultimasDespesas.data && ultimasDespesas.data.length > 0 ? (
              <Tabela>
                <Cabecalho>
                  <Linha>
                    <Th>Data</Th>
                    <Th>Descrição</Th>
                    <Th numerico>Valor</Th>
                  </Linha>
                </Cabecalho>
                <Corpo>
                  {ultimasDespesas.data.map((despesa) => (
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
                        {!despesa.paga ? (
                          <Distintivo cor="aviso" className="ml-2">
                            Por pagar
                          </Distintivo>
                        ) : null}
                      </Td>
                      <Td numerico>{formatarEuros(despesa.valor_total)}</Td>
                    </Linha>
                  ))}
                </Corpo>
              </Tabela>
            ) : (
              <SemRegistos titulo="Sem lançamentos neste mês" />
            )}
          </ConteudoCartao>
        </Cartao>
      </div>
    </>
  )
}
