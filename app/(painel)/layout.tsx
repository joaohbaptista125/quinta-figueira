import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { supabaseConfigurado } from '@/lib/supabase/configuracao'
import { ConfiguracaoEmFalta } from '@/components/configuracao-em-falta'
import { obterPessoaSessao, obterUtilizador } from '@/lib/sessao'
import { BarraInferior, NavegacaoLateral } from '@/components/navegacao'
import { MenuUtilizador } from '@/components/menu-utilizador'
import { IndicadorLigacao } from '@/components/indicador-ligacao'
import { Notificacao } from '@/components/notificacao'
import { Marca } from '@/components/marca'
import { ROTULOS_PERFIL } from '@/lib/rotulos'

export default async function LayoutPainel({
  children,
}: {
  children: React.ReactNode
}) {
  if (!supabaseConfigurado) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <ConfiguracaoEmFalta />
        </div>
      </main>
    )
  }

  const pessoa = await obterPessoaSessao()

  if (!pessoa) {
    const user = await obterUtilizador()
    redirect(user ? '/sem-acesso' : '/entrar')
  }

  const perfilRotulo = pessoa.perfil ? ROTULOS_PERFIL[pessoa.perfil] : null

  return (
    <>
      <IndicadorLigacao />
      <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
        <aside className="hidden border-r border-border bg-card lg:flex lg:h-dvh lg:flex-col lg:sticky lg:top-0">
          <Link
            href="/"
            className="border-b border-border px-4 py-4 transition-colors hover:bg-accent"
          >
            <Marca />
          </Link>
          <div className="flex-1 overflow-y-auto px-2 py-4">
            <NavegacaoLateral perfil={pessoa.perfil} />
          </div>
          <div className="border-t border-border p-3">
            <MenuUtilizador nome={pessoa.nome} perfil={perfilRotulo} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <Link href="/" className="flex items-center gap-2">
                <Marca semTexto />
                <span className="font-semibold tracking-tight">
                  Quinta da Figueira
                </span>
              </Link>
            </div>
          </header>

          {/* O espaço em baixo é o da barra de separadores, que é fixa. */}
          <main className="min-w-0 flex-1 p-4 pb-24 sm:p-6 sm:pb-24 lg:pb-6">
            {children}
          </main>
        </div>
      </div>

      <BarraInferior
        perfil={pessoa.perfil}
        nome={pessoa.nome}
        perfilRotulo={perfilRotulo}
      />

      {/* useSearchParams obriga a uma fronteira de suspensão. */}
      <Suspense fallback={null}>
        <Notificacao />
      </Suspense>
    </>
  )
}
