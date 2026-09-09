import type { Metadata } from 'next'
import { exigirGestao } from '@/lib/sessao'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposCategoria } from '@/components/formularios/campos-simples'
import { Cartao, ConteudoCartao } from '@/components/ui/superficie'
import { guardarCategoria } from '@/lib/accoes/cadastro-diverso'

export const metadata: Metadata = { title: 'Nova categoria' }

export default async function PaginaNovaCategoria() {
  await exigirGestao()
  return (
    <>
      <CabecalhoPagina titulo="Nova categoria de despesa" />
      <Cartao className="max-w-2xl">
        <ConteudoCartao className="pt-4 sm:pt-5">
          <FormularioEntidade
            accao={guardarCategoria}
            hrefCancelar="/financeiro/categorias"
            rotuloGuardar="Criar categoria"
            permitirCriarOutro
          >
            <CamposCategoria />
          </FormularioEntidade>
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
