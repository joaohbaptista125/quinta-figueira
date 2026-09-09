'use client'

import { sair } from '@/lib/accoes/autenticacao'
import { Botao } from '@/components/ui/botao'

export function SairSimples() {
  return (
    <form action={sair}>
      <Botao type="submit" variante="contorno" className="w-full">
        Terminar sessão
      </Botao>
    </form>
  )
}
