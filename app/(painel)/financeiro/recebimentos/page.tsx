import type { Metadata } from 'next'
import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirPessoa } from '@/lib/sessao'
import { eGestao } from '@/lib/permissoes'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { SelectorMes } from '@/components/selector-mes'
import { Indicador } from '@/components/indicador'
import { classesBotao } from '@/components/ui/botao'
import { Cartao, Distintivo, SemRegistos } from '@/components/ui/superficie'
import { Cabecalho, Corpo, Linha, Tabela, Td, Th } from '@/components/ui/tabela'
import { ROTULOS_METODO, ROTULOS_TIPO_RECEBIMENTO } from '@/lib/rotulos'
import {
  deslocarMeses,
  formatarData,
  formatarEuros,
  primeiroDiaDoMes,
} from '@/lib/formatos'

export const metadata: Metadata = { title: 'Recebimentos' }

export default async function PaginaRecebimentos({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const sessao = await exigirPessoa()
  const { mes } = await searchParams
  const periodo = mes ? primeiroDiaDoMes(`${mes}-01`) : primeiroDiaDoMes()
  const fim = deslocarMeses(periodo, 1)
  const supabase = await criarClienteServidor()
  const podeEditar = eGestao(sessao.perfil)

  const { data: recebimentos, error } = await supabase
    .from('recebimentos')
    .select(
      'id, data, valor, tipo, metodo_pagamento, periodo, descricao, documento_fiscal_ref, pessoas(id, nome), contas(nome)',
    )
    .gte('data', periodo)
    .lt('data', fim)
    .order('data', { ascending: false })

  const total = (recebimentos ?? []).reduce(
    (soma, recebimento) => soma + Number(recebimento.valor),
    0,
  )
  const dePenso = (recebimentos ?? [])
    .filter((recebimento) => recebimento.tipo === 'penso')
    .reduce((soma, recebimento) => soma + Number(recebimento.valor), 0)

  return (
    <>
      <CabecalhoPagina
        titulo="Recebimentos"
        descricao="Quem pagou o quê, por que meio e para que conta"
        accoes={
          <>
            <SelectorMes periodo={periodo} />
            {podeEditar ? (
              <Link href="/financeiro/recebimentos/novo" className={classesBotao()}>
                Registar recebimento
              </Link>
            ) : null}
          </>
        }
      />

      {podeEditar ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Indicador rotulo="Total do mês" valor={formatarEuros(total)} tom="positivo" />
          <Indicador rotulo="De pensos" valor={formatarEuros(dePenso)} />
          <Indicador rotulo="Outros" valor={formatarEuros(total - dePenso)} />
        </div>
      ) : null}

      <Cartao>
        {error ? (
          <SemRegistos titulo="Não foi possível carregar" descricao={error.message} />
        ) : recebimentos && recebimentos.length > 0 ? (
          <Tabela>
            <Cabecalho>
              <Linha>
                <Th>Data</Th>
                <Th>Pessoa</Th>
                <Th>Refere-se a</Th>
                <Th>Recebido em</Th>
                <Th numerico>Valor</Th>
              </Linha>
            </Cabecalho>
            <Corpo>
              {recebimentos.map((recebimento) => (
                <Linha key={recebimento.id}>
                  <Td className="whitespace-nowrap text-muted-foreground">
                    {formatarData(recebimento.data)}
                  </Td>
                  <Td>
                    {podeEditar ? (
                      <Link
                        href={`/financeiro/recebimentos/${recebimento.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {recebimento.pessoas?.nome ?? '—'}
                      </Link>
                    ) : (
                      <span className="font-medium">
                        {recebimento.pessoas?.nome ?? '—'}
                      </span>
                    )}
                    {recebimento.documento_fiscal_ref ? (
                      <div className="text-xs text-muted-foreground">
                        Doc. {recebimento.documento_fiscal_ref}
                      </div>
                    ) : null}
                  </Td>
                  <Td>
                    <Distintivo
                      cor={recebimento.tipo === 'penso' ? 'primario' : 'neutro'}
                    >
                      {ROTULOS_TIPO_RECEBIMENTO[recebimento.tipo]}
                    </Distintivo>
                    {recebimento.descricao ? (
                      <div className="text-xs text-muted-foreground">
                        {recebimento.descricao}
                      </div>
                    ) : null}
                  </Td>
                  <Td className="text-muted-foreground">
                    <div className="text-xs">
                      {ROTULOS_METODO[recebimento.metodo_pagamento]}
                      <br />
                      {recebimento.contas?.nome ?? '—'}
                    </div>
                  </Td>
                  <Td numerico className="font-medium">
                    {formatarEuros(recebimento.valor)}
                  </Td>
                </Linha>
              ))}
            </Corpo>
          </Tabela>
        ) : (
          <SemRegistos
            titulo="Sem recebimentos neste mês"
            accao={
              podeEditar ? (
                <Link href="/financeiro/recebimentos/novo" className={classesBotao()}>
                  Registar recebimento
                </Link>
              ) : null
            }
          />
        )}
      </Cartao>
    </>
  )
}
