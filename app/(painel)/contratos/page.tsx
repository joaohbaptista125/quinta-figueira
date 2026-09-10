import type { Metadata } from 'next'
import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirPessoa } from '@/lib/sessao'
import { eGestao } from '@/lib/permissoes'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
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
import { formatarData, formatarEuros, hoje } from '@/lib/formatos'

export const metadata: Metadata = { title: 'Contratos de penso' }

export default async function PaginaContratos({
  searchParams,
}: {
  searchParams: Promise<{ terminados?: string }>
}) {
  const sessao = await exigirPessoa()
  const { terminados } = await searchParams
  const supabase = await criarClienteServidor()
  const hojeIso = hoje()

  let consulta = supabase
    .from('contratos_penso')
    .select(
      'id, valor_mensal, dia_vencimento, data_inicio, data_fim, cavalos(id, nome), pessoas(id, nome)',
    )
    .order('data_inicio', { ascending: false })

  if (terminados !== '1') consulta = consulta.or(`data_fim.is.null,data_fim.gte.${hojeIso}`)

  const { data: contratos, error } = await consulta
  const podeEditar = eGestao(sessao.perfil)

  const totalMensal = (contratos ?? [])
    .filter((contrato) => !contrato.data_fim || contrato.data_fim >= hojeIso)
    .reduce((soma, contrato) => soma + Number(contrato.valor_mensal), 0)

  return (
    <>
      <CabecalhoPagina
        titulo="Contratos de penso"
        descricao={
          podeEditar
            ? `${formatarEuros(totalMensal)} por mês em contratos em vigor`
            : 'Os seus contratos de penso'
        }
        accoes={
          podeEditar ? (
            <Link href="/contratos/novo" className={classesBotao()}>
              Novo contrato
            </Link>
          ) : null
        }
      />

      <div className="mb-4">
        <Link
          href={terminados === '1' ? '/contratos' : '/contratos?terminados=1'}
          className="text-sm text-muted-foreground underline"
        >
          {terminados === '1' ? 'Mostrar só em vigor' : 'Incluir terminados'}
        </Link>
      </div>

      <Cartao>
        {error ? (
          <SemRegistos titulo="Não foi possível carregar" descricao={error.message} />
        ) : contratos && contratos.length > 0 ? (
          <Tabela>
            <Cabecalho>
              <Linha>
                <Th>Cavalo</Th>
                <Th>Cliente</Th>
                <Th>Início</Th>
                <Th>Fim</Th>
                <Th>Vence dia</Th>
                <Th numerico>Valor mensal</Th>
              </Linha>
            </Cabecalho>
            <Corpo>
              {contratos.map((contrato) => {
                const terminado = contrato.data_fim && contrato.data_fim < hojeIso
                return (
                  <Linha key={contrato.id}>
                    <Td>
                      {podeEditar ? (
                        <LigacaoFicha href={`/contratos/${contrato.id}`}>{contrato.cavalos?.nome ?? '—'}</LigacaoFicha>
                      ) : (
                        <span className="font-medium">
                          {contrato.cavalos?.nome ?? '—'}
                        </span>
                      )}
                      {terminado ? (
                        <Distintivo className="ml-2">Terminado</Distintivo>
                      ) : null}
                    </Td>
                    <Td rotulo="Cliente" className="text-muted-foreground">
                      {contrato.pessoas?.nome ?? '—'}
                    </Td>
                    <Td rotulo="Início" className="whitespace-nowrap text-muted-foreground">
                      {formatarData(contrato.data_inicio)}
                    </Td>
                    <Td rotulo="Fim" className="whitespace-nowrap text-muted-foreground">
                      {contrato.data_fim ? formatarData(contrato.data_fim) : '—'}
                    </Td>
                    <Td rotulo="Vence dia" className="text-muted-foreground">
                      {contrato.dia_vencimento}
                    </Td>
                    <Td rotulo="Valor mensal" numerico className="font-medium">
                      {formatarEuros(contrato.valor_mensal)}
                    </Td>
                  </Linha>
                )
              })}
            </Corpo>
          </Tabela>
        ) : (
          <SemRegistos
            titulo="Sem contratos de penso"
            descricao="Crie um contrato por cada cavalo alojado a penso."
            accao={
              podeEditar ? (
                <Link href="/contratos/novo" className={classesBotao()}>
                  Novo contrato
                </Link>
              ) : null
            }
          />
        )}
      </Cartao>
    </>
  )
}
