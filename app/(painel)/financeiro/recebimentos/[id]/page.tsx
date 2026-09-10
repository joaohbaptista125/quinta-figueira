import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { exigirGestao } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { ErroConsulta } from '@/components/erro-consulta'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposRecebimento } from '@/components/formularios/campos-recebimento'
import { BotaoApagar } from '@/components/botao-apagar'
import { Cartao, ConteudoCartao } from '@/components/ui/superficie'
import { apagarRecebimento, guardarRecebimento } from '@/lib/accoes/financeiro'
import { contasActivas, pessoasActivas } from '@/lib/consultas'
import { mensalidadesEmAberto } from '@/lib/consultas-financeiro'
import { formatarData, formatarEuros } from '@/lib/formatos'

export const metadata: Metadata = { title: 'Recebimento' }

export default async function PaginaRecebimento({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await exigirGestao()
  const { id } = await params
  const supabase = await criarClienteServidor()

  const { data: recebimento, error } = await supabase
    .from('recebimentos')
    .select('*, pessoas(nome)')
    .eq('id', id)
    .maybeSingle()

  if (error) return <ErroConsulta erro={error} contexto="o recebimento" />
  if (!recebimento) notFound()

  const [pessoas, contas, mensalidades] = await Promise.all([
    pessoasActivas(supabase),
    contasActivas(supabase),
    mensalidadesEmAberto(supabase),
  ])

  // A mensalidade já liquidada por este recebimento deixa de estar "em aberto",
  // por isso é acrescentada à lista para não se perder a selecção.
  const listaMensalidades =
    recebimento.mensalidade_id &&
    !mensalidades.some(
      (linha) => linha.mensalidade_id === recebimento.mensalidade_id,
    )
      ? [
          {
            mensalidade_id: recebimento.mensalidade_id,
            periodo: recebimento.periodo ?? recebimento.data,
            cliente_id: recebimento.pessoa_id,
            cliente_nome: recebimento.pessoas?.nome ?? '—',
            cavalo_nome: 'mensalidade actual',
            valor_em_falta: 0,
          },
          ...mensalidades,
        ]
      : mensalidades

  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/financeiro/recebimentos', rotulo: 'Recebimentos' }}
        titulo={recebimento.pessoas?.nome ?? 'Recebimento'}
        descricao={`${formatarData(recebimento.data)} · ${formatarEuros(recebimento.valor)}`}
      />
      <Cartao className="max-w-3xl">
        <ConteudoCartao className="pt-4 sm:pt-5">
          <FormularioEntidade
            accao={guardarRecebimento}
            id={recebimento.id}
            hrefCancelar="/financeiro/recebimentos"
            extra={<BotaoApagar accao={apagarRecebimento} id={recebimento.id} />}
          >
            <CamposRecebimento
              recebimento={recebimento}
              pessoas={pessoas}
              contas={contas}
              mensalidades={listaMensalidades}
            />
          </FormularioEntidade>
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
