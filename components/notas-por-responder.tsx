import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  TituloCartao,
} from '@/components/ui/superficie'
import { formatarDataHora } from '@/lib/formatos'

/**
 * As perguntas dos clientes que ainda ninguém respondeu, no painel da equipa.
 *
 * É isto que faz as «Notas e pedidos» funcionarem. A aplicação não sabe dar
 * notificações fiáveis — no iPhone só funcionam com a app no ecrã principal —,
 * por isso o que substitui a notificação é a pergunta estar à vista de quem
 * abre o painel todos os dias. Sem isto, uma pergunta ficava num cavalo à
 * espera que alguém por acaso lá fosse.
 *
 * Não aparece quando não há nada por responder: um cartão vazio todos os dias
 * ensina a não olhar para ele.
 */
export async function NotasPorResponder() {
  const supabase = await criarClienteServidor()

  const { data } = await supabase
    .from('v_notas_por_responder')
    .select('cavalo_id, cavalo_nome, ultimo_texto, ultima_em')
    .eq('por_responder', true)
    .order('ultima_em', { ascending: false })
    .limit(5)

  const porResponder = data ?? []
  if (porResponder.length === 0) return null

  return (
    <Cartao className="mt-4">
      <CabecalhoCartao>
        <TituloCartao className="flex items-center gap-2">
          <MessageSquare className="size-4 text-warning-foreground" aria-hidden />
          {porResponder.length === 1
            ? '1 pergunta por responder'
            : `${porResponder.length} perguntas por responder`}
        </TituloCartao>
        <DescricaoCartao>
          Escritas pelos proprietários na ficha do cavalo
        </DescricaoCartao>
      </CabecalhoCartao>
      <ConteudoCartao className="px-0 sm:px-0">
        <ul className="divide-y divide-border border-t border-border">
          {porResponder.map((linha) => (
            <li key={linha.cavalo_id} className="relative hover:bg-muted/50">
              <Link
                href={`/cavalos/${linha.cavalo_id}`}
                className="block px-4 py-3 sm:px-5"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-medium">{linha.cavalo_nome}</span>
                  <span className="tabular text-xs text-muted-foreground">
                    {formatarDataHora(linha.ultima_em)}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                  {linha.ultimo_texto}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </ConteudoCartao>
    </Cartao>
  )
}
