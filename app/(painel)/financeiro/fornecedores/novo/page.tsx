import type { Metadata } from 'next'
import { exigirGestao } from '@/lib/sessao'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposFornecedor } from '@/components/formularios/campos-simples'
import { Cartao, ConteudoCartao } from '@/components/ui/superficie'
import { guardarFornecedor } from '@/lib/accoes/cadastro-diverso'

export const metadata: Metadata = { title: 'Novo fornecedor' }

export default async function PaginaNovoFornecedor() {
  await exigirGestao()
  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/financeiro/fornecedores', rotulo: 'Fornecedores' }}
        titulo="Novo fornecedor"
      />
      <Cartao className="max-w-2xl">
        <ConteudoCartao className="pt-4 sm:pt-5">
          <FormularioEntidade
            accao={guardarFornecedor}
            hrefCancelar="/financeiro/fornecedores"
            rotuloGuardar="Criar fornecedor"
            permitirCriarOutro
          >
            <CamposFornecedor />
          </FormularioEntidade>
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
