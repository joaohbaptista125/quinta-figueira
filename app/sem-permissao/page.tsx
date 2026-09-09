import type { Metadata } from 'next'
import Link from 'next/link'
import { classesBotao } from '@/components/ui/botao'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  TituloCartao,
} from '@/components/ui/superficie'

export const metadata: Metadata = { title: 'Sem permissão' }

export default function PaginaSemPermissao() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Cartao>
          <CabecalhoCartao>
            <TituloCartao>Sem permissão</TituloCartao>
            <DescricaoCartao>
              O seu perfil não dá acesso a esta secção.
            </DescricaoCartao>
          </CabecalhoCartao>
          <ConteudoCartao>
            <Link href="/" className={classesBotao('contorno', 'normal', 'w-full')}>
              Voltar ao painel
            </Link>
          </ConteudoCartao>
        </Cartao>
      </div>
    </main>
  )
}
