import type { Metadata } from 'next'
import { exigirGestao } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposContrato } from '@/components/formularios/campos-contrato'
import { Cartao, ConteudoCartao } from '@/components/ui/superficie'
import { guardarContrato } from '@/lib/accoes/cadastro-diverso'
import { cavalosActivos, pessoasActivas } from '@/lib/consultas'

export const metadata: Metadata = { title: 'Novo contrato de penso' }

export default async function PaginaNovoContrato({
  searchParams,
}: {
  searchParams: Promise<{ cavalo?: string }>
}) {
  await exigirGestao()
  const { cavalo } = await searchParams
  const supabase = await criarClienteServidor()
  const [cavalos, clientes] = await Promise.all([
    cavalosActivos(supabase),
    pessoasActivas(supabase),
  ])

  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/contratos', rotulo: 'Contratos de penso' }}
        titulo="Novo contrato de penso"
        descricao="As mensalidades são geradas depois, em Pensos do mês."
      />
      <Cartao className="max-w-3xl">
        <ConteudoCartao className="pt-4 sm:pt-5">
          <FormularioEntidade
            accao={guardarContrato}
            hrefCancelar="/contratos"
            rotuloGuardar="Criar contrato"
            permitirCriarOutro
          >
            <CamposContrato
              cavalos={cavalos}
              clientes={clientes}
              cavaloPreSeleccionado={cavalo}
            />
          </FormularioEntidade>
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
