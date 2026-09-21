'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CircleCheck } from 'lucide-react'
import type { Confirmacao } from '@/lib/accoes/comum'

/**
 * Confirmação do que acabou de acontecer.
 *
 * As acções gravam e redireccionam, e com a navegação perde-se o resultado que
 * o formulário tinha para mostrar. O parâmetro `feito` viaja no endereço e é
 * aqui que vira mensagem.
 *
 * A mensagem não viaja no endereço — só a chave. O texto vive aqui, para
 * ninguém poder escrever o que lhe apetecer no URL de outra pessoa.
 */
const MENSAGENS: Record<Confirmacao, string> = {
  criado: 'Registo criado.',
  guardado: 'Alterações guardadas.',
  apagado: 'Registo apagado.',
}

const DURACAO_MS = 4000

function eConfirmacao(valor: string | null): valor is Confirmacao {
  return valor !== null && valor in MENSAGENS
}

export function Notificacao() {
  const parametros = useSearchParams()
  const caminho = usePathname()
  const router = useRouter()
  const marca = parametros.get('feito')

  /*
   * O aviso é guardado em estado, e não lido do endereço no momento de
   * desenhar. Tem de ser assim: a seguir a mostrá-lo limpamos o `feito` do
   * endereço, e uma versão anterior que lia a marca directamente desaparecia
   * no mesmo instante em que a limpava — via-se um piscar e mais nada.
   *
   * O `id` serve para dois avisos seguidos com a mesma palavra reiniciarem o
   * temporizador: sem ele, gravar duas vezes de seguida não mudava o estado e
   * o segundo aviso herdava o tempo que restava do primeiro.
   */
  const [aviso, setAviso] = useState<{ chave: Confirmacao; id: number } | null>(
    null,
  )
  const contador = useRef(0)

  useEffect(() => {
    if (!eConfirmacao(marca)) return

    contador.current += 1
    setAviso({ chave: marca, id: contador.current })

    // Limpa o endereço: recarregar a página ou voltar atrás não deve fazer
    // reaparecer a confirmação de uma coisa já feita.
    const restantes = new URLSearchParams(parametros.toString())
    restantes.delete('feito')
    const consulta = restantes.toString()
    router.replace(consulta ? `${caminho}?${consulta}` : caminho, {
      scroll: false,
    })
    // Só a marca interessa: os outros parâmetros mudam a cada navegação e
    // fariam o aviso reaparecer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marca])

  useEffect(() => {
    if (!aviso) return
    const temporizador = setTimeout(() => setAviso(null), DURACAO_MS)
    return () => clearTimeout(temporizador)
  }, [aviso])

  if (!aviso) return null

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 lg:bottom-6"
    >
      <p className="flex items-center gap-2 rounded-full border border-success/30 bg-card px-4 py-2 text-sm font-medium shadow-lg">
        <CircleCheck className="size-4 text-success" aria-hidden />
        {MENSAGENS[aviso.chave]}
      </p>
    </div>
  )
}
