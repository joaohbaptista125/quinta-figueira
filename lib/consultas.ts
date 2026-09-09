import type { SupabaseClient } from '@supabase/supabase-js'
import type { BaseDados } from '@/lib/tipos-bd'

type Cliente = SupabaseClient<BaseDados>

/**
 * Cavalos activos que ainda não estão alojados em nenhuma box.
 *
 * `incluir` acrescenta o cavalo que já está nesta box, para o formulário de
 * edição não perder a selecção actual.
 */
export async function cavalosSemBox(supabase: Cliente, incluir?: string | null) {
  const [livres, actual] = await Promise.all([
    supabase
      .from('cavalos')
      .select('id, nome, boxes(id)')
      .eq('activo', true)
      .order('nome'),
    incluir
      ? supabase.from('cavalos').select('id, nome').eq('id', incluir).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const semBox = (livres.data ?? [])
    .filter((cavalo) => !cavalo.boxes)
    .map(({ id, nome }) => ({ id, nome }))

  if (actual.data && !semBox.some((cavalo) => cavalo.id === actual.data!.id)) {
    return [actual.data, ...semBox]
  }
  return semBox
}

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
