import { NextResponse, type NextRequest } from 'next/server'
import { criarClienteServidor } from '@/lib/supabase/servidor'

/**
 * Recebe o código de autenticação enviado por email (convite, recuperação de
 * palavra-passe) e troca-o por uma sessão.
 */
export async function GET(pedido: NextRequest) {
  const { searchParams, origin } = new URL(pedido.url)
  const codigo = searchParams.get('code')
  const seguinteBruto = searchParams.get('seguinte') ?? '/'
  // Só caminhos internos: impede redireccionamento para domínios externos.
  const seguinte = seguinteBruto.startsWith('/') ? seguinteBruto : '/'

  if (!codigo) {
    return NextResponse.redirect(`${origin}/entrar?erro=link_invalido`)
  }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.auth.exchangeCodeForSession(codigo)

  if (error) {
    return NextResponse.redirect(`${origin}/entrar?erro=link_expirado`)
  }

  return NextResponse.redirect(`${origin}${seguinte}`)
}
