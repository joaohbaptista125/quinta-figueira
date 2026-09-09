'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { entrar } from '@/lib/accoes/autenticacao'
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
      {pending ? 'A entrar…' : 'Entrar'}
    </Botao>
  )
}

export function FormularioEntrar({ seguinte }: { seguinte: string }) {
  const [resultado, accao] = useActionState(entrar, SEM_RESULTADO)

  return (
    <Cartao>
      <CabecalhoCartao>
        <TituloCartao>Entrar</TituloCartao>
        <DescricaoCartao>
          Use o email com que foi registado no centro.
        </DescricaoCartao>
      </CabecalhoCartao>
      <ConteudoCartao>
        <form action={accao} className="space-y-4">
          <input type="hidden" name="seguinte" value={seguinte} />

          <Campo etiqueta="Email" htmlFor="email" obrigatorio>
            <Entrada
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              required
              autoFocus
            />
          </Campo>

          <Campo etiqueta="Palavra-passe" htmlFor="password" obrigatorio>
            <Entrada
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Campo>

          {resultado.mensagem ? (
            <Aviso tom="erro">{resultado.mensagem}</Aviso>
          ) : null}

          <BotaoSubmeter />

          <p className="text-center text-sm text-muted-foreground">
            <Link href="/recuperar-password" className="underline">
              Esqueci-me da palavra-passe
            </Link>
          </p>
        </form>
      </ConteudoCartao>
    </Cartao>
  )
}
