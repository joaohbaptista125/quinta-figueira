import type { Metadata } from 'next'
import Link from 'next/link'
import { obterPessoaSessao, obterUtilizador } from '@/lib/sessao'
import { classesBotao } from '@/components/ui/botao'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  TituloCartao,
} from '@/components/ui/superficie'
import { FormularioDefinirPassword } from './formulario'

export const metadata: Metadata = { title: 'Definir palavra-passe' }

/**
 * Onde quem foi convidado escolhe a palavra-passe, logo a seguir a entrar
 * pelo link do email.
 *
 * A página é pública porque quem cá chega acabou de ganhar sessão nesse
 * instante — mas sessão tem de ter. Sem ela, o formulário aparecia na mesma e
 * falhava ao gravar com uma mensagem sobre links expirados que não explicava
 * nada a quem estava a criar a conta. Agora diz-se o que se passa antes de
 * pedir seja o que for.
 */
export default async function PaginaDefinirPassword() {
  const utilizador = await obterUtilizador()

  if (!utilizador) {
    return (
      <Cartao>
        <CabecalhoCartao>
          <TituloCartao>O link já não serve</TituloCartao>
          <DescricaoCartao>
            Os links de email só podem ser usados uma vez, e têm prazo. Peça à
            gestão do centro que lhe envie outro convite — ou, se já tem
            palavra-passe, entre com ela.
          </DescricaoCartao>
        </CabecalhoCartao>
        <ConteudoCartao>
          <Link href="/entrar" className={classesBotao()}>
            Ir para a entrada
          </Link>
        </ConteudoCartao>
      </Cartao>
    )
  }

  const pessoa = await obterPessoaSessao()
  const primeiroNome = pessoa?.nome.split(' ')[0]

  return (
    <FormularioDefinirPassword
      titulo={primeiroNome ? `Bem-vindo, ${primeiroNome}` : 'A sua palavra-passe'}
      descricao="Escolha a palavra-passe com que passa a entrar na Quinta da Figueira. Mínimo de 8 caracteres."
    />
  )
}
