import type { Metadata } from 'next'
import { exigirGestao } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposDespesa } from '@/components/formularios/campos-despesa'
import { Cartao, ConteudoCartao } from '@/components/ui/superficie'
import { guardarDespesa } from '@/lib/accoes/financeiro'
import { cavalosActivos, contasActivas } from '@/lib/consultas'

export const metadata: Metadata = { title: 'Lançar despesa' }

export default async function PaginaNovaDespesa() {
  await exigirGestao()
  const supabase = await criarClienteServidor()

  const [categorias, fornecedores, contas, cavalos] = await Promise.all([
    supabase
      .from('categorias_despesa')
      .select('id, nome')
      .eq('activa', true)
      .order('ordem')
      .order('nome'),
    supabase
      .from('fornecedores')
      .select('id, nome, nif')
      .eq('activo', true)
      .order('nome'),
    contasActivas(supabase),
    cavalosActivos(supabase),
  ])

  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/financeiro/despesas', rotulo: 'Despesas' }}
        titulo="Lançar despesa"
        descricao="Use «Guardar e criar outro» para lançar várias de seguida."
      />
      <Cartao className="max-w-3xl">
        <ConteudoCartao className="pt-4 sm:pt-5">
          <FormularioEntidade
            accao={guardarDespesa}
            hrefCancelar="/financeiro/despesas"
            rotuloGuardar="Lançar despesa"
            permitirCriarOutro
          >
            <CamposDespesa
              categorias={categorias.data ?? []}
              fornecedores={fornecedores.data ?? []}
              contas={contas}
              cavalos={cavalos}
            />
          </FormularioEntidade>
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
