import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseChaveAnonima, supabaseUrl } from './configuracao'

/** Caminhos acessíveis sem sessão iniciada. */
const CAMINHOS_PUBLICOS = [
  '/entrar',
  '/recuperar-password',
  '/definir-password',
  '/auth/callback',
  // Onde se trata a sessão que vem no fragmento do link de email. Quem lá
  // chega ainda não tem sessão nenhuma — é isso que lá vai buscar.
  '/auth/ligar',
  // O guia de instalação é partilhado por mensagem antes de a pessoa ter
  // sequer entrado: tem de abrir sem sessão.
  '/instalar',
  '/offline.html',
  // Subscrição de calendário: autentica-se pelo token no endereço, não por
  // sessão — uma aplicação de calendário não sabe iniciar sessão.
  '/calendario',
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

  /*
   * `getClaims()` e não `getUser()`, e isto vale uma ida e volta à rede em
   * **cada pedido**.
   *
   * `getUser()` pergunta ao servidor de autenticação do Supabase quem é a
   * pessoa — é um pedido de rede, não uma leitura do cookie. Como o middleware
   * corre antes de tudo, a página nem começava a ser gerada enquanto essa
   * resposta não chegasse; e a seguir a página fazia a mesma pergunta outra
   * vez, porque a cache do React não atravessa invocações.
   *
   * `getClaims()` verifica a assinatura do próprio token **localmente**,
   * quando o projecto usa chaves assimétricas — zero rede. Se o projecto
   * ainda usar o segredo partilhado antigo (HS256), cai sozinho para
   * `getUser()`, por isso isto nunca é mais lento do que era. A renovação do
   * cookie continua a acontecer: `getClaims()` passa por `getSession()`, que
   * renova o token quando está a expirar.
   *
   * Em termos de segurança não se perde nada: quem decide o que cada pessoa vê
   * é a RLS, e a página volta a verificar a sessão por sua conta. O que o
   * middleware faz é encaminhar quem não tem sessão para `/entrar`, que é
   * conforto e não barreira.
   */
  const { data: credenciais } = await supabase.auth.getClaims()
  const user = credenciais?.claims?.sub ? credenciais.claims : null

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
