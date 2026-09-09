'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { pedirRecuperacao } from '@/lib/accoes/autenticacao'
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
      {pending ? 'A enviar…' : 'Enviar instruções'}
    </Botao>
  )
}

export function FormularioRecuperar() {
  const [resultado, accao] = useActionState(pedirRecuperacao, SEM_RESULTADO)

  return (
    <Cartao>
      <CabecalhoCartao>
        <TituloCartao>Recuperar palavra-passe</TituloCartao>
        <DescricaoCartao>
          Enviamos-lhe um link para definir uma palavra-passe nova.
        </DescricaoCartao>
      </CabecalhoCartao>
      <ConteudoCartao>
        <form action={accao} className="space-y-4">
          <Campo etiqueta="Email" htmlFor="email" obrigatorio>
            <Entrada
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              required
              autoFocus
            />
          </Campo>

          {resultado.mensagem ? (
            <Aviso tom={resultado.ok ? 'sucesso' : 'erro'}>
              {resultado.mensagem}
            </Aviso>
          ) : null}

          <BotaoSubmeter />

          <p className="text-center text-sm text-muted-foreground">
            <Link href="/entrar" className="underline">
              Voltar a entrar
            </Link>
          </p>
        </form>
      </ConteudoCartao>
    </Cartao>
  )
}
