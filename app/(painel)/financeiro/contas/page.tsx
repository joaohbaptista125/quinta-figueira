import type { Metadata } from 'next'
import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirGestao } from '@/lib/sessao'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { Indicador } from '@/components/indicador'
import { classesBotao } from '@/components/ui/botao'
import { Cartao, Distintivo, SemRegistos } from '@/components/ui/superficie'
import { Cabecalho, Corpo, Linha, Tabela, Td, Th } from '@/components/ui/tabela'
import { ROTULOS_TIPO_CONTA } from '@/lib/rotulos'
import { formatarEuros } from '@/lib/formatos'

export const metadata: Metadata = { title: 'Contas' }

export default async function PaginaContas() {
  await exigirGestao()
  const supabase = await criarClienteServidor()

  const { data: contas, error } = await supabase
    .from('v_saldos_contas')
    .select('*')
    .order('nome')

  const totalActivas = (contas ?? [])
    .filter((conta) => conta.activa)
    .reduce((soma, conta) => soma + Number(conta.saldo_actual), 0)

  return (
    <>
      <CabecalhoPagina
        titulo="Contas"
        descricao="Onde o dinheiro do centro está"
        accoes={
          <Link href="/financeiro/contas/nova" className={classesBotao()}>
            Nova conta
          </Link>
        }
      />

      <div className="mb-4">
        <Indicador
          rotulo="Saldo total (contas activas)"
          valor={formatarEuros(totalActivas)}
          tom={totalActivas >= 0 ? 'positivo' : 'negativo'}
        />
      </div>

      <Cartao>
        {error ? (
          <SemRegistos titulo="Não foi possível carregar" descricao={error.message} />
        ) : contas && contas.length > 0 ? (
          <Tabela>
            <Cabecalho>
              <Linha>
                <Th>Conta</Th>
                <Th numerico>Saldo inicial</Th>
                <Th numerico>Recebido</Th>
                <Th numerico>Despesas pagas</Th>
                <Th numerico>Saldo actual</Th>
              </Linha>
            </Cabecalho>
            <Corpo>
              {contas.map((conta) => (
                <Linha key={conta.id}>
                  <Td>
                    <Link
                      href={`/financeiro/contas/${conta.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {conta.nome}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {ROTULOS_TIPO_CONTA[conta.tipo]}
                      {conta.iban ? ` · ${conta.iban}` : ''}
                    </div>
                    {!conta.activa ? (
                      <Distintivo className="mt-1">Inactiva</Distintivo>
                    ) : null}
                  </Td>
                  <Td numerico className="text-muted-foreground">
                    {formatarEuros(conta.saldo_inicial)}
                  </Td>
                  <Td numerico className="text-success">
                    {formatarEuros(conta.total_recebido)}
                  </Td>
                  <Td numerico className="text-destructive">
                    {formatarEuros(conta.total_despesas_pagas)}
                  </Td>
                  <Td numerico className="font-medium">
                    {formatarEuros(conta.saldo_actual)}
                  </Td>
                </Linha>
              ))}
            </Corpo>
          </Tabela>
        ) : (
          <SemRegistos
            titulo="Ainda não há contas"
            descricao="Crie pelo menos a caixa em dinheiro e a conta bancária principal."
            accao={
              <Link href="/financeiro/contas/nova" className={classesBotao()}>
                Nova conta
              </Link>
            }
          />
        )}
      </Cartao>
    </>
  )
}
