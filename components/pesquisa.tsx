'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Entrada } from '@/components/ui/campos'

/** Caixa de pesquisa que actualiza o parâmetro ?q= com um pequeno atraso. */
export function Pesquisa({ placeholder = 'Pesquisar…' }: { placeholder?: string }) {
  const router = useRouter()
  const caminho = usePathname()
  const parametros = useSearchParams()
  const [valor, setValor] = useState(parametros.get('q') ?? '')
  const primeiroRender = useRef(true)

  useEffect(() => {
    if (primeiroRender.current) {
      primeiroRender.current = false
      return
    }

    const temporizador = setTimeout(() => {
      const novos = new URLSearchParams(parametros.toString())
      if (valor.trim()) novos.set('q', valor.trim())
      else novos.delete('q')
      router.replace(`${caminho}?${novos.toString()}`)
    }, 300)

    return () => clearTimeout(temporizador)
    // parametros muda a cada navegação; depender dele reiniciaria o atraso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])

  return (
    <Entrada
      type="search"
      value={valor}
      onChange={(evento) => setValor(evento.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="max-w-xs"
    />
  )
}
