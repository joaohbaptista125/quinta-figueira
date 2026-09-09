import type { Metadata } from 'next'
import { exigirGestao } from '@/lib/sessao'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposPessoa } from '@/components/formularios/campos-pessoa'
import { Cartao, ConteudoCartao } from '@/components/ui/superficie'
import { guardarPessoa } from '@/lib/accoes/pessoas'

export const metadata: Metadata = { title: 'Nova pessoa' }

export default async function PaginaNovaPessoa() {
  await exigirGestao()

  return (
    <>
      <CabecalhoPagina
        titulo="Nova pessoa"
        descricao="Use «Guardar e criar outro» para introduzir várias de seguida."
      />
      <Cartao className="max-w-3xl">
        <ConteudoCartao className="pt-4 sm:pt-5">
          <FormularioEntidade
            accao={guardarPessoa}
            hrefCancelar="/pessoas"
            rotuloGuardar="Criar pessoa"
            permitirCriarOutro
          >
            <CamposPessoa />
          </FormularioEntidade>
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
