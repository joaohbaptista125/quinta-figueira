'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { criarClienteBrowser } from '@/lib/supabase/cliente'
import { classesBotao } from '@/components/ui/botao'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  TituloCartao,
} from '@/components/ui/superficie'

/**
 * Tipos de link que trazem alguém a entrar pela primeira vez, ou a recuperar
 * o acesso. Nos dois casos o passo seguinte é escolher a palavra-passe: sem
 * isso, a pessoa só voltaria a entrar pedindo outro link de cada vez.
 */
const TIPOS_QUE_PEDEM_PALAVRA_PASSE = [
  'magiclink',
  'invite',
  'signup',
  'recovery',
]

/**
 * Lê a sessão do fragmento do endereço e guarda-a.
 *
 * `setSession` é o que escreve os cookies que o servidor depois lê; a seguir a
 * navegação é completa (`location.assign`) e não pelo router, senão o servidor
 * ainda não via a sessão nova.
 *
 * O fragmento é apagado do histórico antes de sair: traz um token de acesso
 * válido, e não tem que ficar no «voltar atrás» de ninguém.
 */
export function LigarSessao({ seguinte }: { seguinte: string }) {
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const fragmento = new URLSearchParams(window.location.hash.slice(1))

    const descricaoErro =
      fragmento.get('error_description') ?? fragmento.get('error')
    if (descricaoErro) {
      setErro(
        'Este link já foi usado ou passou do prazo. Peça à gestão do centro que envie outro.',
      )
      return
    }

    const accessToken = fragmento.get('access_token')
    const refreshToken = fragmento.get('refresh_token')

    // Quando o Supabase troca o destino pelo Site URL, o `seguinte` que o
    // convite pedia perde-se pelo caminho. O `type` do fragmento sobrevive,
    // e diz o mesmo: quem chega assim vem de um link de email.
    const tipo = fragmento.get('type') ?? ''
    const destino =
      seguinte !== '/'
        ? seguinte
        : TIPOS_QUE_PEDEM_PALAVRA_PASSE.includes(tipo)
          ? '/definir-password'
          : '/'

    if (!accessToken || !refreshToken) {
      setErro(
        'Este endereço não traz nenhum convite. Abra o link tal como veio no email, sem o copiar aos bocados.',
      )
      return
    }

    let cancelado = false
    const supabase = criarClienteBrowser()

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (cancelado) return
        if (error) {
          setErro(
            'Este link já foi usado ou passou do prazo. Peça à gestão do centro que envie outro.',
          )
          return
        }
        window.history.replaceState(null, '', window.location.pathname)
        window.location.assign(destino)
      })

    return () => {
      cancelado = true
    }
  }, [seguinte])

  return (
    <Cartao>
      <CabecalhoCartao>
        <TituloCartao>{erro ? 'Não foi possível entrar' : 'A entrar…'}</TituloCartao>
        <DescricaoCartao>
          {erro ?? 'Um instante, estamos a preparar a sua conta.'}
        </DescricaoCartao>
      </CabecalhoCartao>
      {erro ? (
        <ConteudoCartao>
          <Link href="/entrar" className={classesBotao()}>
            Ir para a entrada
          </Link>
        </ConteudoCartao>
      ) : null}
    </Cartao>
  )
}
