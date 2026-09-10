'use server'

import { criarClienteServidor } from '@/lib/supabase/servidor'
import { traduzirErro } from './resultado'

/**
 * Devolve o endereço de subscrição de calendário de quem está autenticado,
 * criando-o na primeira vez. Com `renovar`, gera um token novo e invalida
 * imediatamente qualquer subscrição antiga — é o que se faz se o endereço for
 * partilhado por engano.
 */
export async function obterTokenCalendario(renovar = false) {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('obter_token_calendario', {
    p_renovar: renovar,
  })

  if (error) return { ok: false as const, mensagem: traduzirErro(error) }
  return { ok: true as const, token: data as string }
}
