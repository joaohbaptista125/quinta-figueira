import type { Metadata } from 'next'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirEquipa } from '@/lib/sessao'
import { eInstrutorOuGestao } from '@/lib/permissoes'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { ErroConsulta } from '@/components/erro-consulta'
import { Indicador } from '@/components/indicador'
import { SemRegistos } from '@/components/ui/superficie'
import {
  QuadroPaddocks,
  type CampoDeLargada,
} from '@/components/quadro-paddocks'
import { formatarDiaPorExtenso, hoje } from '@/lib/formatos'

export const metadata: Metadata = { title: 'Paddocks' }

/**
 * O quadro dos campos de largada, hoje.
 *
 * Quem o lê é a equipa, tratador incluído — é coordenação de cavalariça, e
 * era a pergunta que se fazia de viva voz: «o Fidalgo já saiu?». O dono não
 * vem aqui: vê o que lhe interessa na ficha do cavalo dele, e recebe o aviso
 * quando o cavalo é largado.
 *
 * **Escrever é de quem planeia o dia** (gestão e instrutor), e não de toda a
 * equipa — decisão do centro, que fez do tratador um perfil de consulta. A
 * migração `…_tratador_so_consulta.sql` explica o que isso contraria e o que
 * se perde. Aqui isto só evita mostrar botões que a RLS ia recusar.
 */
export default async function PaginaPaddocks() {
  const sessao = await exigirEquipa()
  const supabase = await criarClienteServidor()
  const dia = hoje()

  const [campos, ocupacao, cavalos] = await Promise.all([
    supabase
      .from('paddocks')
      .select('id, numero, nome')
      .eq('activo', true)
      .order('numero'),
    supabase
      .from('paddock_ocupacao')
      .select('id, paddock_id, cavalo_id, cavalos(nome)')
      .eq('data', dia),
    supabase.from('cavalos').select('id, nome').eq('activo', true).order('nome'),
  ])

  if (campos.error) return <ErroConsulta erro={campos.error} contexto="os paddocks" />
  if (ocupacao.error)
    return <ErroConsulta erro={ocupacao.error} contexto="o quadro de hoje" />

  const largados = ocupacao.data ?? []
  const ocupados = new Set(largados.map((linha) => linha.cavalo_id))

  const quadro: CampoDeLargada[] = (campos.data ?? []).map((campo) => ({
    id: campo.id,
    numero: campo.numero,
    nome: campo.nome,
    cavalos: largados
      .filter((linha) => linha.paddock_id === campo.id)
      .map((linha) => ({
        id: linha.id,
        cavalo_id: linha.cavalo_id,
        nome: linha.cavalos?.nome ?? 'Cavalo',
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt')),
  }))

  const disponiveis = (cavalos.data ?? []).filter(
    (cavalo) => !ocupados.has(cavalo.id),
  )

  const podeEscrever = eInstrutorOuGestao(sessao.perfil)

  return (
    <>
      <CabecalhoPagina
        titulo="Paddocks"
        descricao={
          `Quem está largado hoje, ${formatarDiaPorExtenso(dia)}. O quadro limpa-se sozinho à meia-noite.` +
          (podeEscrever ? '' : ' Largar e recolher é da gestão e dos instrutores.')
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Indicador rotulo="Cavalos largados" valor={String(largados.length)} />
        <Indicador
          rotulo="Campos com cavalos"
          valor={`${quadro.filter((campo) => campo.cavalos.length > 0).length} / ${quadro.length}`}
        />
        <Indicador rotulo="Por largar" valor={String(disponiveis.length)} />
      </div>

      {quadro.length > 0 ? (
        <QuadroPaddocks
          campos={quadro}
          disponiveis={disponiveis}
          podeEscrever={podeEscrever}
        />
      ) : (
        <SemRegistos
          titulo="Ainda não há paddocks"
          descricao="Os oito campos vêm com a aplicação. Se não aparecem, a migração dos paddocks ainda não foi aplicada."
        />
      )}
    </>
  )
}
