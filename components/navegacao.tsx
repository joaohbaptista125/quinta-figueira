'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Banknote,
  CalendarCheck,
  CalendarDays,
  CircleUser,
  DoorOpen,
  Ellipsis,
  FileText,
  House,
  LogOut,
  Receipt,
  Shield,
  Tags,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Ferradura } from '@/components/ui/ferradura'
import { sair } from '@/lib/accoes/autenticacao'
import type { PerfilAcesso } from '@/lib/tipos-bd'
import { eGestao, eEquipa, eInstrutorOuGestao } from '@/lib/permissoes'

type Icone = React.ComponentType<{ className?: string }>

type ItemNavegacao = {
  href: string
  rotulo: string
  Icone: Icone
  /** Vai para a barra de baixo no telemóvel; os restantes ficam em «Mais». */
  principal?: boolean
  /** Quem pode ver a entrada. */
  visivel: (perfil: PerfilAcesso | null) => boolean
}

const SEMPRE = () => true

/** Quantas entradas cabem na barra de baixo, contando já com o «Mais». */
const LUGARES_NA_BARRA = 4

export const SECCOES: { titulo: string; itens: ItemNavegacao[] }[] = [
  {
    titulo: 'Centro',
    itens: [
      { href: '/', rotulo: 'Painel', Icone: House, principal: true, visivel: SEMPRE },
      {
        href: '/agenda',
        rotulo: 'Agenda',
        Icone: CalendarDays,
        principal: true,
        visivel: SEMPRE,
      },
      {
        href: '/cavalos',
        rotulo: 'Cavalos',
        Icone: Ferradura,
        principal: true,
        visivel: SEMPRE,
      },
      {
        href: '/pessoas',
        rotulo: 'Pessoas',
        Icone: Users,
        principal: true,
        visivel: (p) => eEquipa(p),
      },
      { href: '/boxes', rotulo: 'Boxes', Icone: DoorOpen, visivel: SEMPRE },
      {
        href: '/contratos',
        rotulo: 'Contratos de penso',
        Icone: FileText,
        visivel: SEMPRE,
      },
      {
        href: '/equipas',
        rotulo: 'Equipas',
        Icone: Shield,
        visivel: (p) => eInstrutorOuGestao(p) || p === 'cliente',
      },
    ],
  },
  {
    titulo: 'Financeiro',
    itens: [
      {
        href: '/financeiro/despesas',
        rotulo: 'Despesas',
        Icone: Receipt,
        visivel: eGestao,
      },
      {
        href: '/financeiro/recebimentos',
        rotulo: 'Recebimentos',
        Icone: Banknote,
        // Para o cliente é a página que lhe interessa e ocupa o lugar que a
        // de «Pessoas» deixa livre na barra.
        principal: true,
        visivel: (p) => eGestao(p) || p === 'cliente',
      },
      {
        href: '/financeiro/pensos',
        rotulo: 'Pensos do mês',
        Icone: CalendarCheck,
        visivel: eGestao,
      },
      {
        href: '/financeiro/contas',
        rotulo: 'Contas',
        Icone: Wallet,
        visivel: eGestao,
      },
      {
        href: '/financeiro/fornecedores',
        rotulo: 'Fornecedores',
        Icone: Truck,
        visivel: eGestao,
      },
      {
        href: '/financeiro/categorias',
        rotulo: 'Categorias de despesa',
        Icone: Tags,
        visivel: eGestao,
      },
    ],
  },
  {
    titulo: 'Pessoal',
    itens: [
      {
        href: '/conta',
        rotulo: 'A minha conta',
        Icone: CircleUser,
        visivel: SEMPRE,
      },
    ],
  },
]

function estaActivo(caminho: string, href: string) {
  if (href === '/') return caminho === '/'
  return caminho === href || caminho.startsWith(`${href}/`)
}

function itensVisiveis(perfil: PerfilAcesso | null) {
  return SECCOES.flatMap((seccao) =>
    seccao.itens.filter((item) => item.visivel(perfil)),
  )
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
            {itens.map(({ href, rotulo, Icone }) => (
              <Link
                key={href}
                href={href}
                aria-current={estaActivo(caminho, href) ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  estaActivo(caminho, href)
                    ? 'bg-primary/12 font-medium text-primary'
                    : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icone className="size-4 shrink-0" />
                {rotulo}
              </Link>
            ))}
          </div>
        )
      })}
    </nav>
  )
}

/**
 * Barra de separadores no fundo do ecrã, para telemóvel.
 *
 * O que aqui estava antes era uma fila de doze pastilhas com deslize
 * horizontal: cabiam três de cada vez, as outras nove não se viam, e não havia
 * como adivinhar que existiam. Numa aplicação que se usa de telemóvel dentro
 * da cavalariça, as quatro secções do dia-a-dia têm de estar debaixo do
 * polegar; o resto vive em «Mais».
 */
export function BarraInferior({
  perfil,
  nome,
  perfilRotulo,
}: {
  perfil: PerfilAcesso | null
  nome: string
  perfilRotulo: string | null
}) {
  const caminho = usePathname()
  const [aberto, setAberto] = React.useState(false)

  const visiveis = itensVisiveis(perfil)
  const naBarra = visiveis
    .filter((item) => item.principal)
    .slice(0, LUGARES_NA_BARRA)
  const hrefsNaBarra = new Set(naBarra.map((item) => item.href))

  // Mudar de página fecha o painel — senão ficava por cima do que se abriu.
  React.useEffect(() => {
    setAberto(false)
  }, [caminho])

  React.useEffect(() => {
    if (!aberto) return
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAberto(false)
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aberto])

  // O «Mais» também acende quando a página aberta é uma das que estão lá
  // dentro, para nunca haver nenhuma sem indicação de onde se está.
  const maisActivo = !naBarra.some((item) => estaActivo(caminho, item.href))

  return (
    <>
      {aberto ? (
        <PainelMais
          perfil={perfil}
          nome={nome}
          perfilRotulo={perfilRotulo}
          excluir={hrefsNaBarra}
          aoFechar={() => setAberto(false)}
        />
      ) : null}

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${naBarra.length + 1}, minmax(0, 1fr))`,
          }}
        >
          {naBarra.map(({ href, rotulo, Icone }) => {
            const activo = estaActivo(caminho, href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={activo ? 'page' : undefined}
                  className={cn(
                    'flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[0.7rem] leading-none transition-colors',
                    activo
                      ? 'font-medium text-primary'
                      : 'text-muted-foreground',
                  )}
                >
                  <Icone className="size-5 shrink-0" />
                  <span className="max-w-full truncate">{rotulo}</span>
                </Link>
              </li>
            )
          })}

          <li>
            <button
              type="button"
              onClick={() => setAberto(true)}
              aria-expanded={aberto}
              className={cn(
                'flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 py-2 text-[0.7rem] leading-none transition-colors',
                maisActivo ? 'font-medium text-primary' : 'text-muted-foreground',
              )}
            >
              <Ellipsis className="size-5 shrink-0" />
              <span>Mais</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  )
}

function PainelMais({
  perfil,
  nome,
  perfilRotulo,
  excluir,
  aoFechar,
}: {
  perfil: PerfilAcesso | null
  nome: string
  perfilRotulo: string | null
  excluir: Set<string>
  aoFechar: () => void
}) {
  const caminho = usePathname()

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button
        type="button"
        aria-label="Fechar"
        onClick={aoFechar}
        className="absolute inset-0 bg-foreground/40"
      />

      <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-card pb-6 shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{nome}</p>
            {perfilRotulo ? (
              <p className="truncate text-xs text-muted-foreground">
                {perfilRotulo}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="rounded-md p-2 text-muted-foreground hover:bg-accent"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-5 px-3 py-4">
          {SECCOES.map((seccao) => {
            const itens = seccao.itens.filter(
              (item) => item.visivel(perfil) && !excluir.has(item.href),
            )
            if (itens.length === 0) return null

            return (
              <div key={seccao.titulo} className="space-y-1">
                <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {seccao.titulo}
                </p>
                {itens.map(({ href, rotulo, Icone }) => (
                  <Link
                    key={href}
                    href={href}
                    aria-current={estaActivo(caminho, href) ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors',
                      estaActivo(caminho, href)
                        ? 'bg-primary/12 font-medium text-primary'
                        : 'hover:bg-accent',
                    )}
                  >
                    <Icone className="size-5 shrink-0 text-muted-foreground" />
                    {rotulo}
                  </Link>
                ))}
              </div>
            )
          })}

          <form action={sair} className="border-t border-border pt-4">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="size-5 shrink-0" />
              Terminar sessão
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
