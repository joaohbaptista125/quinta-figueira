import type { Metadata } from 'next'
import { supabaseConfigurado } from '@/lib/supabase/configuracao'
import { ConfiguracaoEmFalta } from '@/components/configuracao-em-falta'
import { FormularioEntrar } from './formulario'

export const metadata: Metadata = { title: 'Entrar' }

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<{ seguinte?: string }>
}) {
  if (!supabaseConfigurado) return <ConfiguracaoEmFalta />

  const { seguinte } = await searchParams
  return <FormularioEntrar seguinte={seguinte ?? '/'} />
}
