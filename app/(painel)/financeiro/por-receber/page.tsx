import type { Metadata } from 'next'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirGestao } from '@/lib/sessao'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { ErroConsulta } from '@/components/erro-consulta'
import { Indicador } from '@/components/indicador'
import { SelectorMes } from '@/components/selector-mes'
import { BotaoGerarMensalidades } from '@/components/botao-gerar-mensalidades'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  SemRegistos,
  TituloCartao,
} from '@/components/ui/superficie'
import {
  Cabecalho,
  Corpo,
  LigacaoFicha,
  Linha,
  Tabela,
  Td,
  Th,
} from '@/components/ui/tabela'
import {
  diasAte,
  formatarData,
  formatarEuros,
  formatarMesCapitalizado,
  hoje,
  primeiroDiaDoMes,
} from '@/lib/formatos'

export const metadata: Metadata = { title: 'Por receber' }

/**
 * Quem deve ao centro, e desde quando.
 *
 * É a primeira das duas perguntas do financeiro, e até aqui não havia página
 * nenhuma que lhe respondesse. «Pensos do mês» mostrava um mês de cada vez — e
 * quem deve três meses é precisamente quem interessa ver — e ignorava os
 * encargos avulsos, que são dinheiro que o centro adiantou ao ferrador e tem a
 * receber na mesma.
 *
 * Uma linha por **cliente**, e não por mensalidade: a cobrança faz-se por
 * pessoa. Carregar na linha abre a conta-corrente dela, que é onde se recebe.
 */
export default async function PaginaPorReceber({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  await exigirGestao()
  const { mes } = await searchParams
  const periodo = mes ? primeiroDiaDoMes(`${mes}-01`) : primeiroDiaDoMes()
  const supabase = await criarClienteServidor()

  const [pensos, encargos, contratosEmVigor, mensalidadesDoMes] =
    await Promise.all([
      supabase
        .from('v_pensos_por_receber')
        .select(
          'mensalidade_id, periodo, valor_em_falta, cliente_id, cliente_nome, cliente_telefone',
        )
        .gt('valor_em_falta', 0),
      supabase
        .from('v_encargos_por_receber')
        .select('encargo_id, data, valor_em_falta, pessoa_id, pessoa_nome')
        .neq('estado', 'anulado')
        .gt('valor_em_falta', 0),
      supabase
        .from('contratos_penso')
        .select('id', { count: 'exact', head: true })
        .lte('data_inicio', periodo)
        .or(`data_fim.is.null,data_fim.gte.${periodo}`),
      supabase
        .from('mensalidades_penso')
        .select('id', { count: 'exact', head: true })
        .eq('periodo', periodo),
    ])

  if (pensos.error) return <ErroConsulta erro={pensos.error} contexto="as dívidas" />

  type Devedor = {
    id: string
    nome: string
    telefone: string | null
    /** Quantas mensalidades em falta. */
    pensos: number
    valorPensos: number
    /** Quantos encargos avulsos em falta. */
    encargos: number
    valorEncargos: number
    /** A data mais antiga em dívida — é ela que diz o tamanho do problema. */
    desde: string
  }

  const devedores = new Map<string, Devedor>()

  function devedor(id: string, nome: string, telefone: string | null) {
    const existente = devedores.get(id)
    if (existente) return existente
    const novo: Devedor = {
      id,
      nome,
      telefone,
      pensos: 0,
      valorPensos: 0,
      encargos: 0,
      valorEncargos: 0,
      desde: '9999-12-31',
    }
    devedores.set(id, novo)
    return novo
  }

  for (const linha of pensos.data ?? []) {
    const alvo = devedor(linha.cliente_id, linha.cliente_nome, linha.cliente_telefone)
    alvo.pensos += 1
    alvo.valorPensos += Number(linha.valor_em_falta)
    if (linha.periodo < alvo.desde) alvo.desde = linha.periodo
  }

  for (const linha of encargos.data ?? []) {
    const alvo = devedor(linha.pessoa_id, linha.pessoa_nome, null)
    alvo.encargos += 1
    alvo.valorEncargos += Number(linha.valor_em_falta)
    if (linha.data < alvo.desde) alvo.desde = linha.data
  }

  // O mais antigo primeiro: é quem está há mais tempo a dever que precisa de
  // um telefonema, e não quem deve mais euros por acaso.
  const lista = [...devedores.values()].sort((a, b) => a.desde.localeCompare(b.desde))
  const total = lista.reduce(
    (soma, linha) => soma + linha.valorPensos + linha.valorEncargos,
    0,
  )
  const maisAntigo = lista[0]?.desde

  const porGerar = (contratosEmVigor.count ?? 0) - (mensalidadesDoMes.count ?? 0)

  return (
    <>
      <CabecalhoPagina
        titulo="Por receber"
        descricao="Quem deve ao centro, e desde quando. Abra um nome para receber."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Indicador
          rotulo="Em dívida"
          valor={formatarEuros(total)}
          detalhe="Pensos e encargos, de todos os meses"
          tom={total > 0 ? 'negativo' : 'positivo'}
        />
        <Indicador
          rotulo="Clientes"
          valor={String(lista.length)}
          detalhe="com valores em falta"
        />
        <Indicador
          rotulo="Mais antigo"
          valor={maisAntigo ? formatarData(maisAntigo) : '—'}
          detalhe={
            maisAntigo
              ? `${diasAte(maisAntigo, hoje())} dias`
              : 'Não há nada em falta'
          }
          tom={maisAntigo && diasAte(maisAntigo, hoje()) > 60 ? 'negativo' : 'neutro'}
        />
      </div>

      <Cartao>
        <ConteudoCartao className="p-0 sm:p-0">
          {lista.length > 0 ? (
            <Tabela>
              <Cabecalho>
                <Linha>
                  <Th>Cliente</Th>
                  <Th>Desde</Th>
                  <Th numerico>Pensos</Th>
                  <Th numerico>Encargos</Th>
                  <Th numerico>Total</Th>
                </Linha>
              </Cabecalho>
              <Corpo>
                {lista.map((linha) => (
                  <Linha key={linha.id}>
                    <Td>
                      <LigacaoFicha href={`/pessoas/${linha.id}/pensos`}>
                        {linha.nome}
                      </LigacaoFicha>
                      {linha.telefone ? (
                        <div className="text-xs text-muted-foreground">
                          {linha.telefone}
                        </div>
                      ) : null}
                    </Td>
                    <Td rotulo="Desde" className="whitespace-nowrap text-muted-foreground">
                      {formatarData(linha.desde)}
                    </Td>
                    <Td rotulo="Pensos" numerico className="text-muted-foreground">
                      {linha.pensos > 0
                        ? `${formatarEuros(linha.valorPensos)} · ${linha.pensos}`
                        : '—'}
                    </Td>
                    <Td rotulo="Encargos" numerico className="text-muted-foreground">
                      {linha.encargos > 0
                        ? `${formatarEuros(linha.valorEncargos)} · ${linha.encargos}`
                        : '—'}
                    </Td>
                    <Td rotulo="Total" numerico className="font-medium text-destructive">
                      {formatarEuros(linha.valorPensos + linha.valorEncargos)}
                    </Td>
                  </Linha>
                ))}
              </Corpo>
            </Tabela>
          ) : (
            <SemRegistos
              titulo="Ninguém deve nada"
              descricao="Nem mensalidades nem encargos avulsos em falta. Se faltarem mensalidades por gerar, gere-as em baixo."
            />
          )}
        </ConteudoCartao>
      </Cartao>

      <Cartao className="mt-4">
        <CabecalhoCartao>
          <TituloCartao>Mensalidades de {formatarMesCapitalizado(periodo)}</TituloCartao>
          <DescricaoCartao>
            {porGerar > 0 ? (
              <>
                <strong>Faltam {porGerar} por gerar.</strong> Há contratos em
                vigor sem mensalidade neste mês — até as gerar, esse dinheiro
                não aparece em cima.
              </>
            ) : (
              <>
                Estão todas criadas. Gerar outra vez não faz mal nenhum: a
                operação não toca em mensalidades que já existam, nem num valor
                que tenha sido alterado à mão.
              </>
            )}
          </DescricaoCartao>
        </CabecalhoCartao>
        <ConteudoCartao className="flex flex-wrap items-center gap-3">
          <SelectorMes periodo={periodo} />
          <BotaoGerarMensalidades periodo={periodo.slice(0, 7)} />
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
