import { redirect } from 'next/navigation'
import Link from 'next/link'
import { supabaseConfigurado } from '@/lib/supabase/configuracao'
import { ConfiguracaoEmFalta } from '@/components/configuracao-em-falta'
import { obterPessoaSessao, obterUtilizador } from '@/lib/sessao'
import { NavegacaoCompacta, NavegacaoLateral } from '@/components/navegacao'
import { MenuUtilizador } from '@/components/menu-utilizador'
import { IndicadorLigacao } from '@/components/indicador-ligacao'
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

  return (
    <>
      <IndicadorLigacao />
      <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
        <aside className="hidden border-r border-border bg-card lg:flex lg:h-dvh lg:flex-col lg:sticky lg:top-0">
          <Link href="/" className="border-b border-border px-5 py-4">
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Centro Hípico
            </p>
            <p className="text-lg font-semibold tracking-tight">
              Quinta da Figueira
            </p>
          </Link>
          <div className="flex-1 overflow-y-auto px-2 py-4">
            <NavegacaoLateral perfil={pessoa.perfil} />
          </div>
          <div className="border-t border-border p-3">
            <MenuUtilizador
              nome={pessoa.nome}
              perfil={pessoa.perfil ? ROTULOS_PERFIL[pessoa.perfil] : null}
            />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <Link href="/" className="font-semibold tracking-tight">
                Quinta da Figueira
              </Link>
              <MenuUtilizador
                nome={pessoa.nome}
                perfil={pessoa.perfil ? ROTULOS_PERFIL[pessoa.perfil] : null}
                compacto
              />
            </div>
            <NavegacaoCompacta perfil={pessoa.perfil} />
          </header>

          <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </>
  )
}
