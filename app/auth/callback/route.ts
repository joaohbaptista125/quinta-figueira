import { NextResponse, type NextRequest } from 'next/server'
import { criarClienteServidor } from '@/lib/supabase/servidor'

/**
 * Troca por uma sessão o que vem nos links enviados por email.
 *
 * Há três formas de o Supabase devolver a autenticação, e as três têm de
 * funcionar, porque não é a mesma pessoa a pedir e a carregar no link:
 *
 *   ?code=…        PKCE. É o que sai quando a própria pessoa pede (recuperar
 *                  a palavra-passe): a prova fica num cookie do browser dela.
 *                  Só serve no mesmo browser que fez o pedido.
 *
 *   ?token_hash=…  Verificação pelo servidor. Funciona em qualquer browser e
 *                  em qualquer dispositivo, que é o que um convite precisa.
 *
 *   #access_token= Fluxo implícito, em fragmento. O fragmento nunca chega ao
 *                  servidor — nem aqui. Quem o trata é /auth/ligar, no
 *                  browser; aqui só se encaminha para lá.
 *
 * Era isto que faltava: o convite é pedido pela gestão e aberto pelo
 * convidado, num browser que nunca viu o cookie do PKCE. Com só o `?code=`
 * tratado, o link do convite morria sempre.
 */

/** Tipos de link que aceitamos verificar. */
const TIPOS = ['signup', 'invite', 'magiclink', 'recovery', 'email'] as const
type TipoLigacao = (typeof TIPOS)[number]

export async function GET(pedido: NextRequest) {
  const { searchParams, origin } = new URL(pedido.url)

  const seguinteBruto = searchParams.get('seguinte') ?? '/'
  // Só caminhos internos: impede redireccionamento para domínios externos.
  const seguinte = seguinteBruto.startsWith('/') ? seguinteBruto : '/'

  const codigo = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const tipoBruto = searchParams.get('type') ?? ''
  const tipo = (TIPOS as readonly string[]).includes(tipoBruto)
    ? (tipoBruto as TipoLigacao)
    : null

  // O Supabase também devolve o erro no endereço quando o link já foi usado
  // ou expirou.
  if (searchParams.get('error')) {
    return NextResponse.redirect(`${origin}/entrar?erro=link_expirado`)
  }

  if (codigo || tokenHash) {
    const supabase = await criarClienteServidor()

    const { error } = tokenHash
      ? await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: tipo ?? 'magiclink',
        })
      : await supabase.auth.exchangeCodeForSession(codigo!)

    if (error) {
      return NextResponse.redirect(`${origin}/entrar?erro=link_expirado`)
    }

    return NextResponse.redirect(`${origin}${seguinte}`)
  }

  // Sem nada no endereço, a autenticação só pode vir no fragmento. O browser
  // leva-o consigo no encaminhamento, porque o destino não traz fragmento
  // nenhum.
  return NextResponse.redirect(
    `${origin}/auth/ligar?seguinte=${encodeURIComponent(seguinte)}`,
  )
}
