import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { Indicador } from '@/components/indicador'
import { QuadroDoDia } from '@/components/resumo-do-dia'
import { NotasPorResponder } from '@/components/notas-por-responder'
import { AusenciasAnunciadas } from '@/components/ausencias-anunciadas'
import { FerracaoAPrecisar } from '@/components/ferracao-a-precisar'
import { formatarDiaPorExtenso, hoje } from '@/lib/formatos'

/**
 * Painel de instrutores e tratadores: cadastro e o dia, sem financeiro nenhum.
 *
 * É o painel da gestão menos as duas coisas que a RLS não lhes deixa ver ou
 * decidir — os pagamentos declarados e a aprovação de fichas de cavalo.
 */
export async function PainelEquipa({ nome }: { nome: string }) {
  const supabase = await criarClienteServidor()

  const [cavalos, pessoas, largados] = await Promise.all([
    supabase
      .from('cavalos')
      .select('id', { count: 'exact', head: true })
      .eq('activo', true)
      .not('aprovado_em', 'is', null),
    supabase
      .from('pessoas')
      .select('id', { count: 'exact', head: true })
      .eq('activo', true),
    supabase
      .from('paddock_ocupacao')
      .select('id', { count: 'exact', head: true })
      .eq('data', hoje()),
  ])

  return (
    <>
      <CabecalhoPagina
        titulo={`Olá, ${nome.split(' ')[0]}`}
        descricao={formatarDiaPorExtenso(hoje())}
      />

      <QuadroDoDia />

      <NotasPorResponder />
      <AusenciasAnunciadas />

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Indicador rotulo="Cavalos no centro" valor={String(cavalos.count ?? 0)} />
        <Indicador rotulo="Pessoas activas" valor={String(pessoas.count ?? 0)} />
        <Indicador
          rotulo="Nos paddocks hoje"
          valor={String(largados.count ?? 0)}
        />
      </div>

      <div className="mt-4">
        <FerracaoAPrecisar />
      </div>
    </>
  )
}
