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
     * Todos os caminhos excepto ficheiros estáticos, imagens, o service worker,
     * o manifesto e a página de emergência da PWA.
     *
     * Os ficheiros de public/ já são servidos antes do middleware (verificado
     * com `next start`), por isso estas exclusões são redundantes na prática.
     * Ficam explícitas na mesma: o service worker vai buscar offline.html no
     * arranque, normalmente a partir do ecrã de entrada e portanto sem sessão,
     * e se algum dia o middleware lhe chegasse a encaminhá-la para /entrar a
     * cache guardaria a página de login no lugar da página de emergência.
     */
    '/((?!_next/static|_next/image|favicon.ico|sw.js|offline.html|manifest.webmanifest|icones/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
