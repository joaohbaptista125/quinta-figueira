import type { Metadata } from 'next'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirGestao } from '@/lib/sessao'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { SelectorMes } from '@/components/selector-mes'
import { Indicador } from '@/components/indicador'
import { BotaoGerarMensalidades } from '@/components/botao-gerar-mensalidades'
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
  Cabecalho,
  Corpo,
  LigacaoFicha,
  Linha,
  Tabela,
  Td,
  Th,
} from '@/components/ui/tabela'
import { ROTULOS_ESTADO_MENSALIDADE } from '@/lib/rotulos'
import {
  formatarEuros,
  formatarMesCapitalizado,
  primeiroDiaDoMes,
} from '@/lib/formatos'

export const metadata: Metadata = { title: 'Pensos do mês' }

export default async function PaginaPensos({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  await exigirGestao()
  const { mes } = await searchParams
  const periodo = mes ? primeiroDiaDoMes(`${mes}-01`) : primeiroDiaDoMes()
  const supabase = await criarClienteServidor()

  const [pensos, contratosEmVigor] = await Promise.all([
    supabase
      .from('v_pensos_por_receber')
      .select('*')
      .eq('periodo', periodo)
      .order('estado')
      .order('cliente_nome'),
    supabase
      .from('contratos_penso')
      .select('id', { count: 'exact', head: true })
      .lte('data_inicio', periodo)
      .or(`data_fim.is.null,data_fim.gte.${periodo}`),
  ])

  const linhas = pensos.data ?? []
  const total = linhas.reduce((soma, linha) => soma + Number(linha.valor), 0)
  const recebido = linhas.reduce(
    (soma, linha) => soma + Number(linha.valor_pago),
    0,
  )
  const emFalta = total - recebido
  const porGerar = (contratosEmVigor.count ?? 0) - linhas.length

  return (
    <>
      <CabecalhoPagina
        titulo="Pensos do mês"
        descricao={`${formatarMesCapitalizado(periodo)} · abra um cliente para receber`}
        accoes={
          <>
            <SelectorMes periodo={periodo} />
            <BotaoGerarMensalidades periodo={periodo.slice(0, 7)} />
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Indicador rotulo="Facturável no mês" valor={formatarEuros(total)} />
        <Indicador rotulo="Já recebido" valor={formatarEuros(recebido)} tom="positivo" />
        <Indicador
          rotulo="Em falta"
          valor={formatarEuros(emFalta)}
          tom={emFalta > 0 ? 'negativo' : 'positivo'}
        />
      </div>

      {porGerar > 0 ? (
        <Cartao className="mb-4">
          <CabecalhoCartao>
            <TituloCartao>Faltam mensalidades por gerar</TituloCartao>
            <DescricaoCartao>
              Há {porGerar} contrato(s) em vigor sem mensalidade neste mês. Carregue
              em «Gerar mensalidades» para as criar — a operação é segura de repetir.
            </DescricaoCartao>
          </CabecalhoCartao>
        </Cartao>
      ) : null}

      <Cartao>
        <ConteudoCartao className="p-0 sm:p-0">
          {linhas.length > 0 ? (
            <Tabela>
              <Cabecalho>
                <Linha>
                  <Th>Cliente</Th>
                  <Th>Cavalo</Th>
                  <Th>Estado</Th>
                  <Th numerico>Mensalidade</Th>
                  <Th numerico>Pago</Th>
                  <Th numerico>Em falta</Th>
                </Linha>
              </Cabecalho>
              <Corpo>
                {linhas.map((linha) => (
                  <Linha key={linha.mensalidade_id}>
                    <Td>
                      <LigacaoFicha href={`/pessoas/${linha.cliente_id}/pensos`}>
                        {linha.cliente_nome}
                      </LigacaoFicha>
                      {linha.cliente_telefone ? (
                        <div className="text-xs text-muted-foreground">
                          {linha.cliente_telefone}
                        </div>
                      ) : null}
                    </Td>
                    <Td rotulo="Cavalo" className="text-muted-foreground">{linha.cavalo_nome}</Td>
                    <Td rotulo="Estado">
                      <Distintivo
                        cor={linha.estado === 'paga' ? 'sucesso' : 'aviso'}
                      >
                        {ROTULOS_ESTADO_MENSALIDADE[linha.estado]}
                      </Distintivo>
                    </Td>
                    <Td rotulo="Mensalidade" numerico>{formatarEuros(linha.valor)}</Td>
                    <Td rotulo="Pago" numerico className="text-muted-foreground">
                      {formatarEuros(linha.valor_pago)}
                    </Td>
                    <Td
                      rotulo="Em falta"
                      numerico
                      className={
                        Number(linha.valor_em_falta) > 0
                          ? 'font-medium text-destructive'
                          : 'text-muted-foreground'
                      }
                    >
                      {formatarEuros(linha.valor_em_falta)}
                    </Td>
                  </Linha>
                ))}
              </Corpo>
            </Tabela>
          ) : (
            <SemRegistos
              titulo="Sem mensalidades neste mês"
              descricao="Gere as mensalidades a partir dos contratos de penso em vigor."
            />
          )}
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
