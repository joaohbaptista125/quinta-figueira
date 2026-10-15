'use client'

import { useEffect } from 'react'

/**
 * Apanha uma sessão que venha no fragmento e leva-a a quem a sabe tratar.
 *
 * O convite pede ao Supabase que devolva a pessoa a `/auth/callback`. Mas se
 * esse endereço não estiver na lista de **Redirect URLs** do projecto, o
 * Supabase **troca-o em silêncio pelo Site URL** e manda a pessoa para a raiz
 * da aplicação com a sessão no fragmento. A raiz exige sessão, o fragmento
 * nunca chega ao servidor, o middleware não vê ninguém e encaminha para
 * `/entrar` — o browser leva o fragmento consigo, e quem foi convidado
 * aterra num ecrã de entrada normal a pedir-lhe uma palavra-passe que nunca
 * teve. Foi exactamente isto que aconteceu ao primeiro convite a sério.
 *
 * Este componente vive no layout das páginas públicas e desfaz o estrago: vê
 * o fragmento, reconhece-o e encaminha para `/auth/ligar`, que é quem guarda
 * a sessão. Não dispensa pôr `/auth/callback` na lista de Redirect URLs — mas
 * deixa de ser a diferença entre o convite funcionar e não funcionar.
 */
export function SessaoDoFragmento() {
  useEffect(() => {
    // Quem trata do fragmento é o /auth/ligar: ir lá buscá-lo outra vez seria
    // um ciclo.
    if (window.location.pathname.startsWith('/auth/ligar')) return

    const fragmento = window.location.hash
    if (fragmento.length < 2) return

    const valores = new URLSearchParams(fragmento.slice(1))
    const temSessao = valores.has('access_token')
    const temErro = valores.has('error') || valores.has('error_description')
    if (!temSessao && !temErro) return

    // `replace` e não `assign`: o endereço com o token não fica no histórico.
    window.location.replace(`/auth/ligar${fragmento}`)
  }, [])

  return null
}
