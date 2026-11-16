import Link from 'next/link'
import { UserMinus } from 'lucide-react'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  TituloCartao,
} from '@/components/ui/superficie'
import { ROTULOS_TIPO_EVENTO } from '@/lib/rotulos'
import { formatarData, formatarHora, hoje } from '@/lib/formatos'

/**
 * Quem já disse que não vai, nas marcações que ainda estão para vir.
 *
 * O «não vou» manda um aviso ao responsável no momento em que é dito, mas um
 * aviso lido às onze da noite não sobrevive até à manhã do treino. Isto é a
 * rede por baixo: quem abre o painel vê a lista de quem falta antes de ir
 * para o picadeiro, que é quando a informação ainda serve para alguma coisa.
 *
 * **Só o futuro.** Uma ausência de ontem já não é uma decisão a tomar — é
 * assiduidade, e isso vive em `estado` e na ficha do evento.
 */
export async function AusenciasAnunciadas() {
  const supabase = await criarClienteServidor()

  const { data } = await supabase
    .from('evento_participantes')
    .select(
      'id, motivo_ausencia, pessoas(nome), eventos!inner(id, tipo, titulo, data, hora_inicio)',
    )
    .eq('confirmacao', 'nao_vai')
    .gte('eventos.data', hoje())
    .order('data', { referencedTable: 'eventos' })
    .limit(6)

  const ausencias = data ?? []
  if (ausencias.length === 0) return null

  return (
    <Cartao className="mt-4">
      <CabecalhoCartao>
        <TituloCartao className="flex items-center gap-2">
          <UserMinus className="size-4 text-warning-foreground" aria-hidden />
          {ausencias.length === 1
            ? '1 falta anunciada'
            : `${ausencias.length} faltas anunciadas`}
        </TituloCartao>
        <DescricaoCartao>
          Respostas de quem foi convocado para marcações que ainda estão para vir
        </DescricaoCartao>
      </CabecalhoCartao>
      <ConteudoCartao className="px-0 sm:px-0">
        <ul className="divide-y divide-border border-t border-border">
          {ausencias.map((linha) => (
            <li key={linha.id} className="relative hover:bg-muted/50">
              <Link
                href={`/agenda/${linha.eventos.id}`}
                className="block px-4 py-3 sm:px-5"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-medium">
                    {linha.pessoas?.nome ?? 'Alguém'}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {linha.eventos.titulo ??
                      ROTULOS_TIPO_EVENTO[linha.eventos.tipo]}
                  </span>
                  <span className="tabular text-xs text-muted-foreground">
                    {formatarData(linha.eventos.data)} ·{' '}
                    {formatarHora(linha.eventos.hora_inicio)}
                  </span>
                </div>
                {linha.motivo_ausencia ? (
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {linha.motivo_ausencia}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </ConteudoCartao>
    </Cartao>
  )
}
