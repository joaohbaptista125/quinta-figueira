import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { exigirPessoa } from '@/lib/sessao'
import { eInstrutorOuGestao } from '@/lib/permissoes'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposEvento } from '@/components/formularios/campos-evento'
import { Cartao, ConteudoCartao } from '@/components/ui/superficie'
import { guardarEvento } from '@/lib/accoes/eventos'
import { pessoasActivas } from '@/lib/consultas'

export const metadata: Metadata = { title: 'Marcar evento' }

export default async function PaginaNovoEvento({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>
}) {
  const sessao = await exigirPessoa()
  if (!eInstrutorOuGestao(sessao.perfil)) redirect('/sem-permissao')

  const { dia } = await searchParams
  const supabase = await criarClienteServidor()
  const [pessoas, equipas] = await Promise.all([
    pessoasActivas(supabase),
    supabase.from('equipas').select('id, nome').eq('activa', true).order('nome'),
  ])

  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/agenda', rotulo: 'Agenda' }}
        titulo="Marcar evento"
        descricao="Aula, treino de Horseball ou competição. A convocatória faz-se a seguir."
      />
      <Cartao className="max-w-3xl">
        <ConteudoCartao className="pt-4 sm:pt-5">
          <FormularioEntidade
            accao={guardarEvento}
            hrefCancelar="/agenda"
            rotuloGuardar="Marcar"
            permitirCriarOutro
          >
            <CamposEvento
              responsaveis={pessoas}
              equipas={equipas.data ?? []}
              diaPorOmissao={dia}
            />
          </FormularioEntidade>
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
