import type { Metadata } from 'next'
import { exigirGestao } from '@/lib/sessao'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposConta } from '@/components/formularios/campos-simples'
import { Cartao, ConteudoCartao } from '@/components/ui/superficie'
import { guardarConta } from '@/lib/accoes/cadastro-diverso'

export const metadata: Metadata = { title: 'Nova conta' }

export default async function PaginaNovaConta() {
  await exigirGestao()
  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/financeiro/contas', rotulo: 'Contas' }}
        titulo="Nova conta"
      />
      <Cartao className="max-w-2xl">
        <ConteudoCartao className="pt-4 sm:pt-5">
          <FormularioEntidade
            accao={guardarConta}
            hrefCancelar="/financeiro/contas"
            rotuloGuardar="Criar conta"
            permitirCriarOutro
          >
            <CamposConta />
          </FormularioEntidade>
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
