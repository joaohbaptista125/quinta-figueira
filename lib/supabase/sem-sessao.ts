import { createClient } from '@supabase/supabase-js'
import type { BaseDados } from '@/lib/tipos-bd'
import { supabaseChaveAnonima, supabaseUrl } from './configuracao'

/**
 * Cliente Supabase que não guarda nem lê sessão nenhuma.
 *
 * Serve para as operações que falam com o servidor de autenticação em nome de
 * outra pessoa — hoje, enviar um convite. O cliente normal de servidor está
 * ligado aos cookies de quem está a navegar, e `signInWithOtp` mexe no
 * armazenamento de sessão de quem o chama: com o cliente normal, convidar
 * alguém arriscava trocar a sessão de quem convida.
 *
 * Usa a chave anónima, a mesma que o browser tem. Não há aqui nenhum poder
 * extra: enviar um convite é uma operação que o Supabase limita por si.
 */
export function criarClienteSemSessao() {
  return createClient<BaseDados>(supabaseUrl, supabaseChaveAnonima, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
