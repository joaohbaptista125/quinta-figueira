import type { SupabaseClient } from '@supabase/supabase-js'
import type { BaseDados } from '@/lib/tipos-bd'

type Cliente = SupabaseClient<BaseDados>

/** Pessoas activas, para os selectores dos formulários. */
export async function pessoasActivas(supabase: Cliente) {
  const { data } = await supabase
    .from('pessoas')
    .select('id, nome')
    .eq('activo', true)
    .order('nome')
  return data ?? []
}

/** Cavalos activos, para os selectores dos formulários. */
export async function cavalosActivos(supabase: Cliente) {
  const { data } = await supabase
    .from('cavalos')
    .select('id, nome')
    .eq('activo', true)
    .order('nome')
  return data ?? []
}

/** Contas activas, para escolher origem/destino do dinheiro. */
export async function contasActivas(supabase: Cliente) {
  const { data } = await supabase
    .from('contas')
    .select('id, nome, tipo')
    .eq('activa', true)
    .order('nome')
  return data ?? []
}

/**
 * As raças e as pelagens que o formulário do cavalo oferece.
 *
 * Vêm as duas na mesma ida à base — são catorze linhas e não vale a pena
 * gastar duas viagens ao Supabase por causa delas.
 */
export async function opcoesDeCavalo(supabase: Cliente) {
  const { data } = await supabase
    .from('opcoes_cavalo')
    .select('tipo, valor')
    .eq('activa', true)
    .order('ordem')
    .order('valor')

  const de = (tipo: 'raca' | 'pelagem') =>
    (data ?? []).filter((opcao) => opcao.tipo === tipo).map((opcao) => opcao.valor)

  return { racas: de('raca'), pelagens: de('pelagem') }
}
