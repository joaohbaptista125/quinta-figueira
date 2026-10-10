'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { definirPassword } from '@/lib/accoes/autenticacao'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { Campo, Entrada } from '@/components/ui/campos'
import {
  Aviso,
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  TituloCartao,
} from '@/components/ui/superficie'

function BotaoSubmeter() {
  const { pending } = useFormStatus()
  return (
    <Botao type="submit" className="w-full" disabled={pending}>
      {pending ? 'A guardar…' : 'Guardar palavra-passe'}
    </Botao>
  )
}

export function FormularioDefinirPassword({
  titulo = 'Definir palavra-passe',
  descricao = 'Mínimo de 8 caracteres.',
  destino,
  focoAutomatico = true,
}: {
  titulo?: string
  descricao?: string
  /** Para onde voltar depois de gravar. Sem isto, vai para o painel. */
  destino?: string
  /** Desligar quando o formulário é só um cartão entre outros na página. */
  focoAutomatico?: boolean
} = {}) {
  const [resultado, accao] = useActionState(definirPassword, SEM_RESULTADO)

  return (
    <Cartao className="h-fit">
      <CabecalhoCartao>
        <TituloCartao>{titulo}</TituloCartao>
        <DescricaoCartao>{descricao}</DescricaoCartao>
      </CabecalhoCartao>
      <ConteudoCartao>
        <form action={accao} className="space-y-4">
          {destino ? <input type="hidden" name="destino" value={destino} /> : null}
          <Campo etiqueta="Nova palavra-passe" htmlFor="password" obrigatorio>
            <Entrada
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              autoFocus={focoAutomatico}
            />
          </Campo>

          <Campo etiqueta="Repetir" htmlFor="confirmacao" obrigatorio>
            <Entrada
              id="confirmacao"
              name="confirmacao"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Campo>

          {resultado.mensagem ? (
            <Aviso tom={resultado.ok ? 'sucesso' : 'erro'}>
              {resultado.mensagem}
            </Aviso>
          ) : null}

          <BotaoSubmeter />
        </form>
      </ConteudoCartao>
    </Cartao>
  )
}
