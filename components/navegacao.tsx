'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { PerfilAcesso } from '@/lib/tipos-bd'
import { eGestao, eEquipa } from '@/lib/permissoes'

type ItemNavegacao = {
  href: string
  rotulo: string
  /** Quem pode ver a entrada. */
  visivel: (perfil: PerfilAcesso | null) => boolean
}

const SEMPRE = () => true

export const SECCOES: { titulo: string; itens: ItemNavegacao[] }[] = [
  {
    titulo: 'Centro',
    itens: [
      { href: '/', rotulo: 'Painel', visivel: SEMPRE },
      { href: '/cavalos', rotulo: 'Cavalos', visivel: SEMPRE },
      { href: '/pessoas', rotulo: 'Pessoas', visivel: (p) => eEquipa(p) },
      { href: '/boxes', rotulo: 'Boxes', visivel: SEMPRE },
      { href: '/contratos', rotulo: 'Contratos de penso', visivel: SEMPRE },
    ],
  },
  {
    titulo: 'Financeiro',
    itens: [
      { href: '/financeiro/despesas', rotulo: 'Despesas', visivel: eGestao },
      {
        href: '/financeiro/recebimentos',
        rotulo: 'Recebimentos',
        visivel: (p) => eGestao(p) || p === 'cliente',
      },
      { href: '/financeiro/pensos', rotulo: 'Pensos do mês', visivel: eGestao },
      { href: '/financeiro/contas', rotulo: 'Contas', visivel: eGestao },
      {
        href: '/financeiro/fornecedores',
        rotulo: 'Fornecedores',
        visivel: eGestao,
      },
      {
        href: '/financeiro/categorias',
        rotulo: 'Categorias de despesa',
        visivel: eGestao,
      },
    ],
  },
]

function estaActivo(caminho: string, href: string) {
  if (href === '/') return caminho === '/'
  return caminho === href || caminho.startsWith(`${href}/`)
}

export function NavegacaoLateral({ perfil }: { perfil: PerfilAcesso | null }) {
  const caminho = usePathname()

  return (
    <nav className="space-y-5" aria-label="Navegação principal">
      {SECCOES.map((seccao) => {
        const itens = seccao.itens.filter((item) => item.visivel(perfil))
        if (itens.length === 0) return null

        return (
          <div key={seccao.titulo} className="space-y-1">
            <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {seccao.titulo}
            </p>
            {itens.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={estaActivo(caminho, item.href) ? 'page' : undefined}
                className={cn(
                  'block rounded-md px-3 py-2 text-sm transition-colors',
                  estaActivo(caminho, item.href)
                    ? 'bg-primary/12 font-medium text-primary'
                    : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {item.rotulo}
              </Link>
            ))}
          </div>
        )
      })}
    </nav>
  )
}

/** Navegação em pastilhas, com deslize horizontal, para ecrãs pequenos. */
export function NavegacaoCompacta({ perfil }: { perfil: PerfilAcesso | null }) {
  const caminho = usePathname()
  const itens = SECCOES.flatMap((seccao) =>
    seccao.itens.filter((item) => item.visivel(perfil)),
  )

  return (
    <nav
      className="flex gap-1.5 overflow-x-auto px-3 pb-2"
      aria-label="Navegação principal"
    >
      {itens.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={estaActivo(caminho, item.href) ? 'page' : undefined}
          className={cn(
            'shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors',
            estaActivo(caminho, item.href)
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {item.rotulo}
        </Link>
      ))}
    </nav>
  )
}
