import type { NextRequest } from 'next/server'
import { actualizarSessao } from '@/lib/supabase/middleware'
import { supabaseConfigurado } from '@/lib/supabase/configuracao'
import { NextResponse } from 'next/server'

export async function middleware(pedido: NextRequest) {
  // Sem chaves reais não há autenticação possível: deixa passar para a
  // aplicação mostrar as instruções de configuração.
  if (!supabaseConfigurado) return NextResponse.next()
  return actualizarSessao(pedido)
}

export const config = {
  matcher: [
    /*
     * Todos os caminhos excepto ficheiros estáticos, imagens, o service worker
     * e o manifesto da PWA.
     */
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icones/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
