import Link from 'next/link'
import { Hammer } from 'lucide-react'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { classesBotao } from '@/components/ui/botao'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  Distintivo,
  SemRegistos,
  TituloCartao,
} from '@/components/ui/superficie'
import { formatarData } from '@/lib/formatos'

/**
 * Os cavalos que precisam do ferrador, no painel de quem trabalha no centro.
 *
 * É a pergunta de cadastro que vale a pena ter à frente todos os dias: a
 * volta do ferrador marca-se com dias de antecedência, e o que falhava era
 * sempre o mesmo — o cavalo que ficou de fora da última volta.
 *
 * Ao contrário dos outros cartões do painel, **este aparece sempre**, mesmo
 * vazio: «está tudo em dia» é informação, e é o oposto dos cartões de coisas
 * por responder, onde o vazio não diz nada que valha a interrupção.
 */
export async function FerracaoAPrecisar() {
  const supabase = await criarClienteServidor()

  const { data } = await supabase
    .from('v_ferracao_cavalos')
    .select('cavalo_id, cavalo_nome, proxima_em, estado')
    .in('estado', ['atrasada', 'esta_semana', 'sem_registo'])
    .order('proxima_em', { nullsFirst: false })
    .limit(8)

  const linhas = data ?? []

  return (
    <Cartao>
      <CabecalhoCartao className="flex flex-row items-start justify-between gap-2">
        <div>
          <TituloCartao className="flex items-center gap-2">
            <Hammer className="size-4 text-muted-foreground" aria-hidden />
            Ferração a precisar
          </TituloCartao>
          <DescricaoCartao>
            Atrasados, marcados para esta semana e sem registo nenhum
          </DescricaoCartao>
        </div>
        <Link href="/cavalos" className={classesBotao('contorno', 'pequeno')}>
          Ver cavalos
        </Link>
      </CabecalhoCartao>
      <ConteudoCartao className="px-0 sm:px-0">
        {linhas.length > 0 ? (
          <ul className="divide-y divide-border border-t border-border">
            {linhas.map((linha) => (
              <li key={linha.cavalo_id} className="relative hover:bg-muted/50">
                <Link
                  href={`/cavalos/${linha.cavalo_id}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-2.5 sm:px-5"
                >
                  <span className="font-medium">{linha.cavalo_nome}</span>
                  <span className="flex items-baseline gap-2">
                    {linha.proxima_em ? (
                      <span className="tabular text-xs text-muted-foreground">
                        {formatarData(linha.proxima_em)}
                      </span>
                    ) : null}
                    <Distintivo
                      cor={linha.estado === 'atrasada' ? 'perigo' : 'aviso'}
                    >
                      {linha.estado === 'atrasada'
                        ? 'Atrasada'
                        : linha.estado === 'esta_semana'
                          ? 'Esta semana'
                          : 'Sem registo'}
                    </Distintivo>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <SemRegistos
            titulo="Nenhum cavalo a precisar"
            descricao="Todos têm a próxima ferração marcada para daqui a mais de uma semana."
          />
        )}
      </ConteudoCartao>
    </Cartao>
  )
}
