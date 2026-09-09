import { cache } from 'react'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import type { PerfilAcesso } from '@/lib/tipos-bd'
import { eEquipa, eGestao } from '@/lib/permissoes'

export { eEquipa, eGestao }

export type PessoaSessao = {
  id: string
  nome: string
  email: string | null
  perfil: PerfilAcesso | null
  authUserId: string
}

/** Origem pública da aplicação, para os links enviados por email. */
export async function obterOrigem() {
  const configurada = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configurada) return configurada.replace(/\/$/, '')

  const cabecalhos = await headers()
  const anfitriao = cabecalhos.get('x-forwarded-host') ?? cabecalhos.get('host')
  const protocolo = cabecalhos.get('x-forwarded-proto') ?? 'https'
  return anfitriao ? `${protocolo}://${anfitriao}` : 'http://localhost:3000'
}

/**
 * Utilizador autenticado, ou null.
 *
 * Embrulhado em cache() do React: numa mesma renderização, o layout e a página
 * chamam isto várias vezes, e cada `getUser()` é um pedido à rede ao servidor
 * de autenticação do Supabase — não uma leitura local do cookie. Sem a cache,
 * uma navegação custava três desses pedidos em fila.
 */
export const obterUtilizador = cache(async () => {
  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

/**
 * Pessoa associada à sessão actual, ou null.
 *
 * Devolve null tanto para quem não tem sessão como para quem tem conta em
 * auth.users mas ainda não está ligado a uma ficha de pessoa — nesse caso a
 * aplicação encaminha para /sem-acesso.
 *
 * Também em cache: o layout do painel e a própria página precisam ambos da
 * pessoa, e sem isto seriam duas consultas iguais por navegação.
 */
export const obterPessoaSessao = cache(
  async (): Promise<PessoaSessao | null> => {
    const user = await obterUtilizador()
    if (!user) return null

    const supabase = await criarClienteServidor()
    const { data } = await supabase
      .from('pessoas')
      .select('id, nome, email, perfil')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!data) return null

    return { ...data, authUserId: user.id }
  },
)

/** Exige sessão com ficha de pessoa. Encaminha se não houver. */
export async function exigirPessoa(): Promise<PessoaSessao> {
  const pessoa = await obterPessoaSessao()
  if (!pessoa) {
    // obterUtilizador() já está em cache — não faz pedido novo.
    const user = await obterUtilizador()
    redirect(user ? '/sem-acesso' : '/entrar')
  }
  return pessoa
}

/**
 * Exige perfil admin/gestor para as páginas de financeiro.
 * A RLS já protege os dados; isto evita mostrar ecrãs vazios a quem não deve
 * sequer ver a secção.
 */
export async function exigirGestao(): Promise<PessoaSessao> {
  const pessoa = await exigirPessoa()
  if (!eGestao(pessoa.perfil)) redirect('/sem-permissao')
  return pessoa
}

export async function exigirEquipa(): Promise<PessoaSessao> {
  const pessoa = await exigirPessoa()
  if (!eEquipa(pessoa.perfil)) redirect('/sem-permissao')
  return pessoa
}
