import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'
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
 * As fichas que os clientes inscreveram e que ninguém decidiu, no painel.
 *
 * É o mesmo princípio de `<NotasPorResponder>` e de
 * `<PagamentosPorConfirmar>`: a aplicação não sabe dar notificações fiáveis
 * (no iPhone só funcionam com a app no ecrã principal), por isso o que
 * substitui a notificação é a coisa estar à vista de quem abre o painel todos
 * os dias. Sem isto, um cavalo inscrito ficava à espera de alguém ir à
 * listagem por acaso.
 *
 * Não aparece quando não há nada por decidir — um cartão vazio todos os dias
 * ensina a não olhar para ele.
 */
export async function CavalosPorAprovar() {
  const supabase = await criarClienteServidor()

  const { data } = await supabase
    .from('cavalos')
    .select('id, nome, raca, criado_em, pessoas(nome)')
    .is('aprovado_em', null)
    .order('criado_em', { ascending: false })
    .limit(5)

  const porAprovar = data ?? []
  if (porAprovar.length === 0) return null

  return (
    <Cartao className="mt-4">
      <CabecalhoCartao>
        <TituloCartao className="flex items-center gap-2">
          <ClipboardCheck className="size-4 text-warning-foreground" aria-hidden />
          {porAprovar.length === 1
            ? '1 cavalo por aprovar'
            : `${porAprovar.length} cavalos por aprovar`}
        </TituloCartao>
        <DescricaoCartao>
          Inscritos pelos proprietários. Até serem aprovados não entram em
          contratos nem em convocatórias.
        </DescricaoCartao>
      </CabecalhoCartao>
      <ConteudoCartao className="px-0 sm:px-0">
        <ul className="divide-y divide-border border-t border-border">
          {porAprovar.map((cavalo) => (
            <li key={cavalo.id} className="relative hover:bg-muted/50">
              <Link
                href={`/cavalos/${cavalo.id}`}
                className="block px-4 py-3 sm:px-5"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-medium">{cavalo.nome}</span>
                  <span className="tabular text-xs text-muted-foreground">
                    {formatarDataHora(cavalo.criado_em)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {cavalo.pessoas?.nome ?? 'Proprietário por confirmar'}
                  {cavalo.raca ? ` · ${cavalo.raca}` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </ConteudoCartao>
    </Cartao>
  )
}
