import type { Metadata } from 'next'
import { exigirGestao } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposCavalo } from '@/components/formularios/campos-cavalo'
import { Cartao, ConteudoCartao } from '@/components/ui/superficie'
import { guardarCavalo } from '@/lib/accoes/cavalos'
import { opcoesDeCavalo, pessoasActivas } from '@/lib/consultas'

export const metadata: Metadata = { title: 'Novo cavalo' }

export default async function PaginaNovoCavalo() {
  await exigirGestao()
  const supabase = await criarClienteServidor()
  const [proprietarios, { racas, pelagens }] = await Promise.all([
    pessoasActivas(supabase),
    opcoesDeCavalo(supabase),
  ])

  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/cavalos', rotulo: 'Cavalos' }}
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
            <CamposCavalo
              proprietarios={proprietarios}
              racas={racas}
              pelagens={pelagens}
            />
          </FormularioEntidade>
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
