'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { deslocarMeses, formatarMesCapitalizado } from '@/lib/formatos'

/** Navegação mês a mês através do parâmetro ?mes=AAAA-MM. */
export function SelectorMes({ periodo }: { periodo: string }) {
  const router = useRouter()
  const caminho = usePathname()
  const parametros = useSearchParams()

  function irPara(novoPeriodo: string) {
    const novos = new URLSearchParams(parametros.toString())
    novos.set('mes', novoPeriodo.slice(0, 7))
    router.push(`${caminho}?${novos.toString()}`)
  }

  return (
    <div className="flex items-center gap-1">
      <Botao
        variante="contorno"
        tamanho="icone"
        aria-label="Mês anterior"
        onClick={() => irPara(deslocarMeses(periodo, -1))}
      >
        <span aria-hidden>‹</span>
      </Botao>
      <span className="min-w-40 text-center text-sm font-medium">
        {formatarMesCapitalizado(periodo)}
      </span>
      <Botao
        variante="contorno"
        tamanho="icone"
        aria-label="Mês seguinte"
        onClick={() => irPara(deslocarMeses(periodo, 1))}
      >
        <span aria-hidden>›</span>
      </Botao>
    </div>
  )
}
