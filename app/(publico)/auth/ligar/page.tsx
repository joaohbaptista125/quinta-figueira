import type { Metadata } from 'next'
import { LigarSessao } from './ligar-sessao'

export const metadata: Metadata = { title: 'A entrar…' }

/**
 * Último passo dos links de email que trazem a sessão no fragmento.
 *
 * O fragmento (`#access_token=…`) nunca é enviado ao servidor — faz parte da
 * norma do HTTP. Por isso esta página existe: é a única maneira de o ler, e
 * tem de ser no browser.
 */
export default async function PaginaLigar({
  searchParams,
}: {
  searchParams: Promise<{ seguinte?: string }>
}) {
  const { seguinte } = await searchParams
  const destino = seguinte?.startsWith('/') ? seguinte : '/'
  return <LigarSessao seguinte={destino} />
}
