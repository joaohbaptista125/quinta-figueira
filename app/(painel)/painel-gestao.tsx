import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { Indicador } from '@/components/indicador'
import { QuadroDoDia } from '@/components/resumo-do-dia'
import { CavalosPorAprovar } from '@/components/cavalos-por-aprovar'
import { PagamentosPorConfirmar } from '@/components/pagamentos-por-confirmar'
import { NotasPorResponder } from '@/components/notas-por-responder'
import { AusenciasAnunciadas } from '@/components/ausencias-anunciadas'
import { FerracaoAPrecisar } from '@/components/ferracao-a-precisar'
import { formatarDiaPorExtenso, hoje } from '@/lib/formatos'

/**
 * O painel da gestão: o que está marcado hoje, e o que está à espera de uma
 * decisão.
 * =============================================================================
 *
 * **O dinheiro saiu daqui de propósito.** Receitas, despesas, saldos e pensos
 * por receber viviam nesta página **e** em `/financeiro`, que é onde se vai
 * quando a pergunta é sobre dinheiro. Em duplicado, o painel passava a ser um
 * relatório mensal — com selector de mês e tudo — em vez de ser o que se abre
 * de manhã. Quem quer os números abre o Financeiro; a porta de lá é
 * exactamente a mesma pergunta («quem me deve», «o que gastei») e com mais
 * detalhe.
 *
 * O que ficou divide-se em duas coisas, e por essa ordem:
 *
 * 1. **O que alguém de fora pôs à espera de resposta** — cavalos inscritos,
 *    pagamentos declarados, perguntas nas notas, faltas anunciadas. São as
 *    quatro coisas que um cliente faz dentro desta aplicação, e cada uma
 *    delas fica parada até a gestão lhe tocar. Os cartões **desaparecem
 *    quando estão vazios**: num dia normal não há nenhum, e o painel é só a
 *    agenda e os números.
 * 2. **Os números de cadastro** — quantos cavalos, quantos proprietários,
 *    quantas pessoas. Não mudam de um dia para o outro, e é isso que os torna
 *    úteis: é a dimensão do centro, não uma métrica a vigiar.
 */
export async function PainelGestao({ nome }: { nome: string }) {
  const supabase = await criarClienteServidor()

  const [cavalos, proprietarios, pessoas, largados] = await Promise.all([
    supabase
      .from('cavalos')
      .select('id', { count: 'exact', head: true })
      .eq('activo', true)
      .not('aprovado_em', 'is', null),
    // Quem tem o papel de proprietário, e não quem por acaso tem um cavalo:
    // é o papel que descreve o que a pessoa é no centro.
    supabase
      .from('pessoa_papeis')
      .select('pessoa_id', { count: 'exact', head: true })
      .eq('papel', 'proprietario'),
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

      <CavalosPorAprovar />
      <PagamentosPorConfirmar compacto />
      <NotasPorResponder />
      <AusenciasAnunciadas />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador rotulo="Cavalos no centro" valor={String(cavalos.count ?? 0)} />
        <Indicador
          rotulo="Proprietários"
          valor={String(proprietarios.count ?? 0)}
        />
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
