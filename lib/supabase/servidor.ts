import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { BaseDados } from '@/lib/tipos-bd'
import { supabaseChaveAnonima, supabaseUrl } from './configuracao'

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 *
 * Em Server Components a escrita de cookies é ignorada pelo Next; a renovação
 * da sessão acontece no middleware, por isso o catch é intencional.
 */
export async function criarClienteServidor() {
  const armazemCookies = await cookies()

  return createServerClient<BaseDados>(supabaseUrl, supabaseChaveAnonima, {
    cookies: {
      getAll() {
        return armazemCookies.getAll()
      },
      setAll(cookiesParaGravar) {
        try {
          for (const { name, value, options } of cookiesParaGravar) {
            armazemCookies.set(name, value, options)
          }
        } catch {
          // Server Component: o middleware trata da renovação da sessão.
        }
      },
    },
  })
}
