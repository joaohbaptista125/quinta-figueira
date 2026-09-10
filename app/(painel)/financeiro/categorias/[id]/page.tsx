import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { exigirGestao } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { ErroConsulta } from '@/components/erro-consulta'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposCategoria } from '@/components/formularios/campos-simples'
import { BotaoApagar } from '@/components/botao-apagar'
import { Cartao, ConteudoCartao } from '@/components/ui/superficie'
import { apagarCategoria, guardarCategoria } from '@/lib/accoes/cadastro-diverso'

export const metadata: Metadata = { title: 'Categoria de despesa' }

export default async function PaginaCategoria({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await exigirGestao()
  const { id } = await params
  const supabase = await criarClienteServidor()

  const { data: categoria, error } = await supabase
    .from('categorias_despesa')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) return <ErroConsulta erro={error} contexto="a categoria de despesa" />
  if (!categoria) notFound()

  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/financeiro/categorias', rotulo: 'Categorias' }}
        titulo={categoria.nome}
      />
      <Cartao className="max-w-2xl">
        <ConteudoCartao className="pt-4 sm:pt-5">
          <FormularioEntidade
            accao={guardarCategoria}
            id={categoria.id}
            hrefCancelar="/financeiro/categorias"
            extra={<BotaoApagar accao={apagarCategoria} id={categoria.id} />}
          >
            <CamposCategoria categoria={categoria} />
          </FormularioEntidade>
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
