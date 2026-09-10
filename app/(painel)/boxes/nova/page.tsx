import type { Metadata } from 'next'
import { exigirGestao } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposBox } from '@/components/formularios/campos-box'
import { Cartao, ConteudoCartao } from '@/components/ui/superficie'
import { guardarBox } from '@/lib/accoes/cadastro-diverso'
import { cavalosSemBox } from '@/lib/consultas'

export const metadata: Metadata = { title: 'Nova box' }

export default async function PaginaNovaBox() {
  await exigirGestao()
  const supabase = await criarClienteServidor()
  const disponiveis = await cavalosSemBox(supabase)

  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/boxes', rotulo: 'Boxes' }}
        titulo="Nova box"
        descricao="Use «Guardar e criar outro» para registar a cavalariça toda de seguida."
      />
      <Cartao className="max-w-2xl">
        <ConteudoCartao className="pt-4 sm:pt-5">
          <FormularioEntidade
            accao={guardarBox}
            hrefCancelar="/boxes"
            rotuloGuardar="Criar box"
            permitirCriarOutro
          >
            <CamposBox cavalosDisponiveis={disponiveis} />
          </FormularioEntidade>
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
