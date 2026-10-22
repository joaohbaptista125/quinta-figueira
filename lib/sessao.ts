import { cache } from 'react'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { escolherOrigem } from '@/lib/origem'
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
  const cabecalhos = await headers()
  return escolherOrigem(
    process.env.NEXT_PUBLIC_SITE_URL,
    cabecalhos.get('x-forwarded-host') ?? cabecalhos.get('host'),
    cabecalhos.get('x-forwarded-proto') ?? 'https',
  )
}

/**
 * Quem está autenticado, ou null. Só o `id` — é tudo o que a aplicação usa.
 *
 * **`getClaims()` e não `getUser()`**, e a diferença é uma ida e volta à rede
 * em cada renderização. `getUser()` pergunta ao servidor de autenticação do
 * Supabase quem é a pessoa; `getClaims()` verifica a assinatura do próprio
 * token **localmente** quando o projecto usa chaves assimétricas. Com o
 * segredo partilhado antigo (HS256) a biblioteca cai sozinha para `getUser()`,
 * por isso isto nunca é mais lento do que era — mas só rende depois de as
 * chaves assimétricas estarem ligadas no Supabase.
 *
 * Em segurança não se perde nada: a assinatura é verificada à mesma, e quem
 * decide o que cada pessoa vê continua a ser a RLS, que lê o token do seu
 * lado.
 *
 * Continua embrulhado em `cache()` do React: numa mesma renderização o layout
 * e a página precisam ambos da sessão.
 */
export const obterUtilizador = cache(
  async (): Promise<{ id: string } | null> => {
    const supabase = await criarClienteServidor()
    const { data } = await supabase.auth.getClaims()
    const sub = data?.claims?.sub
    return sub ? { id: sub } : null
  },
)

/**
 * Pessoa associada à sessão actual, ou null.
 *
 * Com `obterUtilizador()` a resolver-se localmente, isto passa a ser a
 * **primeira e única** ida à rede do caminho da sessão: eram três em fila
 * (middleware, página, e só então a consulta a `pessoas`).
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
