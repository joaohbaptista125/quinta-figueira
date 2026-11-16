import type { Metadata } from 'next'
import { exigirPessoa } from '@/lib/sessao'
import { eGestao } from '@/lib/permissoes'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposCavalo } from '@/components/formularios/campos-cavalo'
import { Aviso, Cartao, ConteudoCartao } from '@/components/ui/superficie'
import { guardarCavalo } from '@/lib/accoes/cavalos'
import { opcoesDeCavalo, pessoasActivas } from '@/lib/consultas'

export const metadata: Metadata = { title: 'Novo cavalo' }

/**
 * A mesma página serve a gestão e o cliente, e o que muda é o modo.
 *
 * O cliente inscreve o cavalo dele e a ficha fica **por aprovar** — existe
 * porque o acesso é dado muitas vezes antes de haver ficha nenhuma, e até
 * agora ele entrava e não tinha nada para ver. O que ele escreve não entra no
 * centro sozinho: a gestão confirma no painel.
 */
export default async function PaginaNovoCavalo() {
  const sessao = await exigirPessoa()
  const souGestao = eGestao(sessao.perfil)

  const supabase = await criarClienteServidor()
  const [proprietarios, { racas, pelagens }] = await Promise.all([
    souGestao ? pessoasActivas(supabase) : Promise.resolve([]),
    opcoesDeCavalo(supabase),
  ])

  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/cavalos', rotulo: 'Cavalos' }}
        titulo={souGestao ? 'Novo cavalo' : 'Inscrever um cavalo'}
        descricao={
          souGestao
            ? 'Use «Guardar e criar outro» para introduzir vários de seguida.'
            : 'Fica à espera de confirmação da gestão do centro.'
        }
      />
      <Cartao className="max-w-3xl">
        <ConteudoCartao className="pt-4 sm:pt-5">
          {souGestao ? null : (
            <Aviso tom="info" className="mb-5">
              O cavalo fica registado em seu nome e <strong>a aguardar
              confirmação</strong> da gestão. Enquanto ninguém decidir, pode
              corrigir o que escreveu; depois de aprovado, as correcções
              pedem-se nas notas da ficha.
            </Aviso>
          )}

          <FormularioEntidade
            accao={guardarCavalo}
            hrefCancelar="/cavalos"
            rotuloGuardar={souGestao ? 'Criar cavalo' : 'Inscrever cavalo'}
            permitirCriarOutro={souGestao}
          >
            <CamposCavalo
              proprietarios={proprietarios}
              racas={racas}
              pelagens={pelagens}
              modo={souGestao ? 'completo' : 'proposta'}
            />
          </FormularioEntidade>
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
