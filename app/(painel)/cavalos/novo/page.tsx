import type { Metadata } from 'next'
import { exigirGestao } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposCavalo } from '@/components/formularios/campos-cavalo'
import { Cartao, ConteudoCartao } from '@/components/ui/superficie'
import { guardarCavalo } from '@/lib/accoes/cavalos'

export const metadata: Metadata = { title: 'Novo cavalo' }

export default async function PaginaNovoCavalo() {
  await exigirGestao()
  const supabase = await criarClienteServidor()
  const { data: proprietarios } = await supabase
    .from('pessoas')
    .select('id, nome')
    .eq('activo', true)
    .order('nome')

  return (
    <>
      <CabecalhoPagina
        titulo="Novo cavalo"
        descricao="Use «Guardar e criar outro» para introduzir vários de seguida."
      />
      <Cartao className="max-w-3xl">
        <ConteudoCartao className="pt-4 sm:pt-5">
          <FormularioEntidade
            accao={guardarCavalo}
            hrefCancelar="/cavalos"
            rotuloGuardar="Criar cavalo"
            permitirCriarOutro
          >
            <CamposCavalo proprietarios={proprietarios ?? []} />
          </FormularioEntidade>
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
