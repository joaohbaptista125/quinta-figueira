import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { exigirGestao } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { ErroConsulta } from '@/components/erro-consulta'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposBox } from '@/components/formularios/campos-box'
import { BotaoApagar } from '@/components/botao-apagar'
import { Cartao, ConteudoCartao } from '@/components/ui/superficie'
import { apagarBox, guardarBox } from '@/lib/accoes/cadastro-diverso'
import { cavalosSemBox } from '@/lib/consultas'

export const metadata: Metadata = { title: 'Box' }

export default async function PaginaBox({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await exigirGestao()
  const { id } = await params
  const supabase = await criarClienteServidor()

  const { data: box, error } = await supabase
    .from('boxes')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) return <ErroConsulta erro={error} contexto="a box" />
  if (!box) notFound()

  const disponiveis = await cavalosSemBox(supabase, box.cavalo_id)

  return (
    <>
      <CabecalhoPagina titulo={`Box ${box.identificacao}`} descricao={box.zona ?? undefined} />
      <Cartao className="max-w-2xl">
        <ConteudoCartao className="pt-4 sm:pt-5">
          <FormularioEntidade
            accao={guardarBox}
            id={box.id}
            hrefCancelar="/boxes"
            extra={<BotaoApagar accao={apagarBox} id={box.id} />}
          >
            <CamposBox box={box} cavalosDisponiveis={disponiveis} />
          </FormularioEntidade>
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
