import type { Metadata } from 'next'
import Link from 'next/link'
import { exigirGestao } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposDespesa } from '@/components/formularios/campos-despesa'
import { Aviso, Cartao, ConteudoCartao } from '@/components/ui/superficie'
import { classesBotao } from '@/components/ui/botao'
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
      .select('id, nome')
      .eq('activo', true)
      .order('nome'),
    contasActivas(supabase),
    cavalosActivos(supabase),
  ])

  if ((contas ?? []).length === 0) {
    return (
      <>
        <CabecalhoPagina titulo="Lançar despesa" />
        <Cartao className="max-w-2xl">
          <ConteudoCartao className="space-y-3 pt-4 sm:pt-5">
            <Aviso tom="atencao">
              Ainda não há contas registadas. Uma despesa tem sempre de sair de
              uma conta.
            </Aviso>
            <Link href="/financeiro/contas/nova" className={classesBotao()}>
              Criar conta
            </Link>
          </ConteudoCartao>
        </Cartao>
      </>
    )
  }

  return (
    <>
      <CabecalhoPagina
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
