import type { Metadata } from 'next'
import { SairSimples } from '@/components/sair-simples'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  TituloCartao,
} from '@/components/ui/superficie'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { redirect } from 'next/navigation'
import { classesBotao } from '@/components/ui/botao'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Sem acesso' }

/**
 * Utilizador autenticado que ainda não está ligado a uma ficha de pessoa.
 * Acontece quando alguém é convidado antes de a ficha existir, ou com um email
 * diferente do que consta no cadastro.
 */
export default async function PaginaSemAcesso() {
  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/entrar')

  const { data: jaHaAdmin } = await supabase.rpc('existe_admin')

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Cartao>
          <CabecalhoCartao>
            <TituloCartao>Conta ainda sem acesso</TituloCartao>
            <DescricaoCartao>
              A sua conta ({user.email}) está criada, mas ainda não está
              associada a nenhuma ficha do centro.
            </DescricaoCartao>
          </CabecalhoCartao>
          <ConteudoCartao className="space-y-3 text-sm">
            {jaHaAdmin === false ? (
              <>
                <p>
                  Ainda não existe nenhum administrador. Como é a primeira conta,
                  pode criar já o acesso de gestão.
                </p>
                <Link href="/primeiro-acesso" className={classesBotao()}>
                  Configurar o primeiro administrador
                </Link>
              </>
            ) : (
              <p className="text-muted-foreground">
                Peça à gestão do centro que crie a sua ficha com este mesmo
                email. Assim que existir, o acesso fica activo.
              </p>
            )}
            <SairSimples />
          </ConteudoCartao>
        </Cartao>
      </div>
    </main>
  )
}
