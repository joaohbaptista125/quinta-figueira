import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { supabaseConfigurado } from '@/lib/supabase/configuracao'
import { ConfiguracaoEmFalta } from '@/components/configuracao-em-falta'
import { FormularioPrimeiroAcesso } from './formulario'

export const metadata: Metadata = { title: 'Primeiro acesso' }

export default async function PaginaPrimeiroAcesso() {
  if (!supabaseConfigurado) return <ConfiguracaoEmFalta />

  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/entrar?seguinte=/primeiro-acesso')

  const { data: jaHaAdmin } = await supabase.rpc('existe_admin')
  if (jaHaAdmin) redirect('/')

  return <FormularioPrimeiroAcesso email={user.email ?? ''} />
}
