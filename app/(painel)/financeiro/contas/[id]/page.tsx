import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { exigirGestao } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { ErroConsulta } from '@/components/erro-consulta'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposConta } from '@/components/formularios/campos-simples'
import { BotaoApagar } from '@/components/botao-apagar'
import { Cartao, ConteudoCartao } from '@/components/ui/superficie'
import { apagarConta, guardarConta } from '@/lib/accoes/cadastro-diverso'
import { formatarEuros } from '@/lib/formatos'

export const metadata: Metadata = { title: 'Conta' }

export default async function PaginaConta({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await exigirGestao()
  const { id } = await params
  const supabase = await criarClienteServidor()

  const [conta, saldo] = await Promise.all([
    supabase.from('contas').select('*').eq('id', id).maybeSingle(),
    supabase.from('v_saldos_contas').select('saldo_actual').eq('id', id).maybeSingle(),
  ])

  if (conta.error) return <ErroConsulta erro={conta.error} contexto="a conta" />
  if (!conta.data) notFound()

  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/financeiro/contas', rotulo: 'Contas' }}
        titulo={conta.data.nome}
        descricao={
          saldo.data
            ? `Saldo actual: ${formatarEuros(saldo.data.saldo_actual)}`
            : undefined
        }
      />
      <Cartao className="max-w-2xl">
        <ConteudoCartao className="pt-4 sm:pt-5">
          <FormularioEntidade
            accao={guardarConta}
            id={conta.data.id}
            hrefCancelar="/financeiro/contas"
            extra={<BotaoApagar accao={apagarConta} id={conta.data.id} />}
          >
            <CamposConta conta={conta.data} />
          </FormularioEntidade>
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
