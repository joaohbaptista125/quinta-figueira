import 'server-only'

import type { criarClienteServidor } from '@/lib/supabase/servidor'

type Cliente = Awaited<ReturnType<typeof criarClienteServidor>>

/**
 * A conta onde o dinheiro entra — sem obrigar ninguém a criá-la primeiro.
 * =============================================================================
 *
 * `recebimentos.conta_id` e `despesas.conta_id` são `not null`, e isso é para
 * continuar assim: é o que faz `v_saldos_contas` bater certo. Mas a aplicação
 * estava a transformar isso num muro — quem queria confirmar um pagamento
 * batia em «ainda não há contas registadas, crie uma conta», e para um centro
 * que não liga a app a banco nenhum isso é burocracia pura, ainda por cima com
 * a palavra «conta» a querer dizer outra coisa.
 *
 * Por isso há **sempre uma Caixa**: se não existir nenhuma conta, é criada
 * aqui, na altura em que o primeiro movimento precisa dela. Quem quiser
 * separar o dinheiro por banco cria mais contas e passa a escolher; quem não
 * quiser nunca ouve falar do assunto.
 */

export const CAIXA_POR_OMISSAO = 'Caixa'

export type DestinoDoDinheiro =
  | { ok: true; id: string }
  | { ok: false; erro: string }

/**
 * Devolve a conta a usar: a escolhida, a única que existe, ou uma Caixa nova.
 *
 * Nunca devolve `null` em silêncio — ou há conta, ou há motivo.
 */
export async function contaDeDestino(
  supabase: Cliente,
  escolhida?: string | null,
): Promise<DestinoDoDinheiro> {
  if (escolhida) return { ok: true, id: escolhida }

  const { data: existentes, error: erroLeitura } = await supabase
    .from('contas')
    .select('id')
    .eq('activa', true)
    .order('criado_em')
    .limit(1)

  if (erroLeitura) {
    return {
      ok: false,
      erro: 'Não foi possível saber para que conta entra o dinheiro.',
    }
  }
  if (existentes && existentes.length > 0) {
    return { ok: true, id: existentes[0].id }
  }

  const { data: nova, error } = await supabase
    .from('contas')
    .insert({ nome: CAIXA_POR_OMISSAO, tipo: 'caixa', saldo_inicial: 0 })
    .select('id')
    .maybeSingle()

  if (nova) return { ok: true, id: nova.id }

  // 23505: outra sessão criou a Caixa entre a leitura e a escrita. Não é erro
  // nenhum — é a Caixa que se queria.
  if (error?.code === '23505') {
    const { data: jaExiste } = await supabase
      .from('contas')
      .select('id')
      .eq('nome', CAIXA_POR_OMISSAO)
      .maybeSingle()
    if (jaExiste) return { ok: true, id: jaExiste.id }
  }

  return {
    ok: false,
    erro:
      'Não foi possível criar a caixa onde o dinheiro entra. Crie-a em Financeiro → Caixa e bancos.',
  }
}
