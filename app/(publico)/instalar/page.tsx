import type { Metadata } from 'next'
import Link from 'next/link'
import { Bell, Share, SquarePlus } from 'lucide-react'
import { classesBotao } from '@/components/ui/botao'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  TituloCartao,
} from '@/components/ui/superficie'

export const metadata: Metadata = {
  title: 'Instalar no telemóvel',
  description:
    'Como pôr a Quinta da Figueira no ecrã principal do telemóvel e receber avisos.',
}

/**
 * O guia que a gestão partilha com quem é convidado.
 *
 * É uma página pública de propósito: manda-se o link por mensagem antes de a
 * pessoa sequer ter entrado, e tem de abrir sem sessão.
 *
 * Existe por uma razão concreta: **no iPhone as notificações só funcionam com
 * a aplicação no ecrã principal.** Num separador normal do Safari não há
 * sequer pedido de autorização. Sem este guia, metade das pessoas nunca
 * chegaria a poder ser avisada.
 */
export default function PaginaInstalar() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Pôr a aplicação no telemóvel
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Leva menos de um minuto. Fica com um ícone como as outras aplicações,
          abre mais depressa, e é o que lhe permite ser avisado quando há
          novidades suas.
        </p>
      </div>

      <Cartao>
        <CabecalhoCartao>
          <TituloCartao>iPhone e iPad</TituloCartao>
          <DescricaoCartao>Tem de ser pelo Safari.</DescricaoCartao>
        </CabecalhoCartao>
        <ConteudoCartao>
          <ol className="ml-4 list-decimal space-y-2 text-sm">
            <li>Abra este site no <strong>Safari</strong>.</li>
            <li>
              Toque em{' '}
              <Share className="inline size-4 align-text-bottom" aria-hidden />{' '}
              <strong>Partilhar</strong>, na barra de baixo.
            </li>
            <li>
              Deslize a lista e escolha{' '}
              <strong>Adicionar ao ecrã principal</strong>.
            </li>
            <li>Toque em <strong>Adicionar</strong>, no canto superior.</li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            No iPhone isto não é opcional para os avisos: a Apple só os dá a
            aplicações instaladas. Num separador normal do Safari, o botão de
            notificações nem aparece.
          </p>
        </ConteudoCartao>
      </Cartao>

      <Cartao>
        <CabecalhoCartao>
          <TituloCartao>Android</TituloCartao>
          <DescricaoCartao>Pelo Chrome.</DescricaoCartao>
        </CabecalhoCartao>
        <ConteudoCartao>
          <ol className="ml-4 list-decimal space-y-2 text-sm">
            <li>
              Costuma aparecer sozinho um aviso a propor{' '}
              <strong>Instalar aplicação</strong> — se aparecer, chega tocar.
            </li>
            <li>
              Se não aparecer, toque nos{' '}
              <SquarePlus className="inline size-4 align-text-bottom" aria-hidden />{' '}
              três pontos do Chrome e escolha{' '}
              <strong>Adicionar ao ecrã principal</strong>.
            </li>
          </ol>
        </ConteudoCartao>
      </Cartao>

      <Cartao>
        <CabecalhoCartao>
          <TituloCartao className="flex items-center gap-2">
            <Bell className="size-4 text-muted-foreground" aria-hidden />
            Depois de instalar: ligar os avisos
          </TituloCartao>
        </CabecalhoCartao>
        <ConteudoCartao>
          <ol className="ml-4 list-decimal space-y-2 text-sm">
            <li>Abra a aplicação pelo ícone novo, não pelo browser.</li>
            <li>
              Entre e vá a <strong>A minha conta</strong>.
            </li>
            <li>
              Em <strong>Notificações</strong>, toque em{' '}
              <strong>Avisar-me neste aparelho</strong> e aceite quando o
              telemóvel perguntar.
            </li>
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            A autorização é de cada aparelho. Se usar o telemóvel e o
            computador, tem de a dar nos dois. E pode desligá-la no mesmo sítio
            quando quiser.
          </p>
        </ConteudoCartao>
      </Cartao>

      <div className="flex justify-center">
        <Link href="/entrar" className={classesBotao()}>
          Ir para a entrada
        </Link>
      </div>
    </div>
  )
}
