'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { reclamarPrimeiroAdmin } from '@/lib/accoes/autenticacao'
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
      {pending ? 'A criar…' : 'Criar administrador'}
    </Botao>
  )
}

export function FormularioPrimeiroAcesso({ email }: { email: string }) {
  const [resultado, accao] = useActionState(
    reclamarPrimeiroAdmin,
    SEM_RESULTADO,
  )

  return (
    <Cartao>
      <CabecalhoCartao>
        <TituloCartao>Primeiro acesso</TituloCartao>
        <DescricaoCartao>
          Ainda não existe administrador. A conta {email} vai ficar com perfil de
          administrador.
        </DescricaoCartao>
      </CabecalhoCartao>
      <ConteudoCartao>
        <form action={accao} className="space-y-4">
          <Campo etiqueta="O seu nome" htmlFor="nome" obrigatorio>
            <Entrada id="nome" name="nome" required autoFocus />
          </Campo>

          {resultado.mensagem ? (
            <Aviso tom="erro">{resultado.mensagem}</Aviso>
          ) : null}

          <BotaoSubmeter />
        </form>
      </ConteudoCartao>
    </Cartao>
  )
}
