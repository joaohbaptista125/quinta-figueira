import type { SupabaseClient } from '@supabase/supabase-js'
import type { BaseDados } from '@/lib/tipos-bd'
import type { OpcaoMensalidade } from '@/components/formularios/campos-recebimento'

type Cliente = SupabaseClient<BaseDados>

/**
 * Mensalidades de penso ainda por liquidar, para o selector do formulário de
 * recebimento. Inclui os meses anteriores porque há sempre atrasos.
 */
export async function mensalidadesEmAberto(
  supabase: Cliente,
): Promise<OpcaoMensalidade[]> {
  const { data } = await supabase
    .from('v_pensos_por_receber')
    .select(
      'mensalidade_id, periodo, cliente_id, cliente_nome, cavalo_nome, valor_em_falta',
    )
    .neq('estado', 'paga')
    .gt('valor_em_falta', 0)
    .order('periodo', { ascending: false })
    .limit(200)

  return data ?? []
}
