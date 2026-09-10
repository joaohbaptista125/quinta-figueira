'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CircleCheck } from 'lucide-react'
import type { Confirmacao } from '@/lib/accoes/comum'

/**
 * Confirmação do que acabou de acontecer.
 *
 * As acções gravam e redireccionam, e com a navegação perde-se o resultado que
 * o formulário tinha para mostrar. Numa edição o destino é a própria ficha onde
 * já se estava: sem isto, carregar em «Guardar» não mudava nada visível.
 *
 * A mensagem não viaja no endereço — só a chave. O texto vive aqui, para
 * ninguém poder escrever o que lhe apetecer no URL de outra pessoa.
 */
const MENSAGENS: Record<Confirmacao, string> = {
  criado: 'Registo criado.',
  guardado: 'Alterações guardadas.',
  apagado: 'Registo apagado.',
}

function eConfirmacao(valor: string | null): valor is Confirmacao {
  return valor !== null && valor in MENSAGENS
}

export function Notificacao() {
  const parametros = useSearchParams()
  const caminho = usePathname()
  const router = useRouter()
  const marca = parametros.get('feito')
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    if (!eConfirmacao(marca)) return

    setVisivel(true)

    // Limpa o endereço logo a seguir: recarregar a página ou voltar atrás não
    // deve fazer reaparecer uma confirmação de uma coisa já feita.
    const restantes = new URLSearchParams(parametros.toString())
    restantes.delete('feito')
    const consulta = restantes.toString()
    router.replace(consulta ? `${caminho}?${consulta}` : caminho, {
      scroll: false,
    })

    const temporizador = setTimeout(() => setVisivel(false), 4000)
    return () => clearTimeout(temporizador)
    // Depende só da marca: o router.replace muda os parâmetros e reiniciaria
    // o temporizador a meio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marca])

  if (!visivel || !eConfirmacao(marca)) return null

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 lg:bottom-6"
    >
      <p className="flex items-center gap-2 rounded-full border border-success/30 bg-card px-4 py-2 text-sm font-medium shadow-lg">
        <CircleCheck className="size-4 text-success" aria-hidden />
        {MENSAGENS[marca]}
      </p>
    </div>
  )
}
