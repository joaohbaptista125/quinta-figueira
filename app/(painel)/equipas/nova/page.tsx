import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { exigirPessoa } from '@/lib/sessao'
import { eInstrutorOuGestao } from '@/lib/permissoes'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposEquipa } from '@/components/formularios/campos-equipa'
import { Cartao, ConteudoCartao } from '@/components/ui/superficie'
import { guardarEquipa } from '@/lib/accoes/eventos'
import { pessoasActivas } from '@/lib/consultas'

export const metadata: Metadata = { title: 'Nova equipa' }

export default async function PaginaNovaEquipa() {
  const sessao = await exigirPessoa()
  if (!eInstrutorOuGestao(sessao.perfil)) redirect('/sem-permissao')

  const supabase = await criarClienteServidor()
  const pessoas = await pessoasActivas(supabase)

  return (
    <>
      <CabecalhoPagina titulo="Nova equipa" />
      <Cartao className="max-w-3xl">
        <ConteudoCartao className="pt-4 sm:pt-5">
          <FormularioEntidade
            accao={guardarEquipa}
            hrefCancelar="/equipas"
            rotuloGuardar="Criar equipa"
          >
            <CamposEquipa pessoas={pessoas} />
          </FormularioEntidade>
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
