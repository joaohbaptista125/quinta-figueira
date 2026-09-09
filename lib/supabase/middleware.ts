import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseChaveAnonima, supabaseUrl } from './configuracao'

/** Caminhos acessíveis sem sessão iniciada. */
const CAMINHOS_PUBLICOS = [
  '/entrar',
  '/recuperar-password',
  '/definir-password',
  '/auth/callback',
  '/offline.html',
]

function ehPublico(caminho: string) {
  return CAMINHOS_PUBLICOS.some(
    (publico) => caminho === publico || caminho.startsWith(`${publico}/`),
  )
}

/**
 * Renova a sessão em cada pedido e encaminha para /entrar quem não tem sessão.
 * A resposta devolvida tem de ser a que o Next envia, para os cookies
 * actualizados não se perderem.
 */
export async function actualizarSessao(pedido: NextRequest) {
  let resposta = NextResponse.next({ request: pedido })

  const supabase = createServerClient(supabaseUrl, supabaseChaveAnonima, {
    cookies: {
      getAll() {
        return pedido.cookies.getAll()
      },
      setAll(cookiesParaGravar) {
        for (const { name, value } of cookiesParaGravar) {
          pedido.cookies.set(name, value)
        }
        resposta = NextResponse.next({ request: pedido })
        for (const { name, value, options } of cookiesParaGravar) {
          resposta.cookies.set(name, value, options)
        }
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const caminho = pedido.nextUrl.pathname

  if (!user && !ehPublico(caminho)) {
    const destino = pedido.nextUrl.clone()
    destino.pathname = '/entrar'
    destino.searchParams.set('seguinte', caminho)
    return NextResponse.redirect(destino)
  }

  if (user && caminho === '/entrar') {
    const destino = pedido.nextUrl.clone()
    destino.pathname = '/'
    destino.search = ''
    return NextResponse.redirect(destino)
  }

  return resposta
}
