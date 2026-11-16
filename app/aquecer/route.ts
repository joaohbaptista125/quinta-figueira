import { NextResponse } from 'next/server'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { supabaseConfigurado } from '@/lib/supabase/configuracao'

/**
 * Manter a aplicação acordada.
 * =============================================================================
 *
 * **O problema, medido e não suposto.** Com o servidor e a base na mesma
 * região, os dados a 0 ms e a sessão verificada localmente, o que resta a
 * explicar «lenta a reagir» é a função ser criada de novo. E os registos da
 * Vercel dizem-no sem margem: num período de 50 minutos a meio da manhã,
 * **zero pedidos**. Numa casa de ~80 pessoas que entram aos bocados, quase
 * toda a gente apanha sempre um arranque a frio — 2 a 3 segundos antes de o
 * primeiro byte sair.
 *
 * Isto não torna a aplicação mais rápida: **mantém-na acordada**, que é outra
 * coisa e é a que falta. Quem bate aqui de cinco em cinco minutos deixa uma
 * instância quente, e quem abrir a seguir encontra-a.
 *
 * **O que isto toca, e porquê.** Não basta devolver `200`: uma rota que não
 * fala com nada deixava fria exactamente a parte que custa — carregar o
 * cliente do Supabase e abrir a ligação à base. Daí a contagem, que é a mais
 * barata que há (`head: true` não devolve linhas nenhumas, mede a viagem e
 * não o trabalho da base) e corre com a chave anónima, por isso a RLS
 * devolve-lhe zero. **Não há aqui nada a proteger**: não lê dados de
 * ninguém, não escreve, e não diz nada que não esteja na página de entrada.
 *
 * **É público de propósito** — ver `CAMINHOS_PUBLICOS` no middleware. Um
 * serviço externo que batesse aqui com sessão não existe.
 *
 * Quem bate: no plano Hobby, o cron da Vercel corre **uma vez por dia**, o
 * que não serve para nada disto. Serve um serviço externo gratuito
 * (cron-job.org, UptimeRobot) apontado a `/aquecer` de cinco em cinco
 * minutos. O plano Pro resolve-o pelo cron da própria Vercel, e aí passa a
 * haver um `crons` no `vercel.json`.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const inicio = performance.now()

  if (!supabaseConfigurado) {
    return NextResponse.json({ acordada: true, base: 'por configurar' })
  }

  const supabase = await criarClienteServidor()
  const { error } = await supabase
    .from('contas')
    .select('id', { count: 'exact', head: true })

  return NextResponse.json(
    {
      acordada: true,
      base: error ? 'sem resposta' : 'acordada',
      ms: Math.round(performance.now() - inicio),
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
