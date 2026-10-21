import type { Metadata } from 'next'
import { exigirGestao } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposRecebimento } from '@/components/formularios/campos-recebimento'
import { Cartao, ConteudoCartao } from '@/components/ui/superficie'
import { guardarRecebimento } from '@/lib/accoes/financeiro'
import { contasActivas, pessoasActivas } from '@/lib/consultas'
import { mensalidadesEmAberto } from '@/lib/consultas-financeiro'

export const metadata: Metadata = { title: 'Registar recebimento' }

export default async function PaginaNovoRecebimento({
  searchParams,
}: {
  searchParams: Promise<{ mensalidade?: string }>
}) {
  await exigirGestao()
  const { mensalidade } = await searchParams
  const supabase = await criarClienteServidor()

  const [pessoas, contas, mensalidades] = await Promise.all([
    pessoasActivas(supabase),
    contasActivas(supabase),
    mensalidadesEmAberto(supabase),
  ])

  const preSeleccionada = mensalidade
    ? mensalidades.find((linha) => linha.mensalidade_id === mensalidade)
    : undefined

  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/financeiro/recebimentos', rotulo: 'Recebimentos' }}
        titulo="Registar recebimento"
        descricao="Use «Guardar e criar outro» para lançar vários de seguida."
      />
      <Cartao className="max-w-3xl">
        <ConteudoCartao className="pt-4 sm:pt-5">
          <FormularioEntidade
            accao={guardarRecebimento}
            hrefCancelar="/financeiro/recebimentos"
            rotuloGuardar="Registar recebimento"
            permitirCriarOutro
          >
            <CamposRecebimento
              pessoas={pessoas}
              contas={contas}
              mensalidades={mensalidades}
              mensalidadePreSeleccionada={preSeleccionada}
            />
          </FormularioEntidade>
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
