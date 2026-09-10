'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Botao } from '@/components/ui/botao'
import { Entrada } from '@/components/ui/campos'
import { deslocarDias, hoje } from '@/lib/formatos'

/** Navegação dia a dia através do parâmetro ?dia=AAAA-MM-DD. */
export function SelectorDia({ dia }: { dia: string }) {
  const router = useRouter()
  const caminho = usePathname()
  const parametros = useSearchParams()

  function irPara(novoDia: string) {
    const novos = new URLSearchParams(parametros.toString())
    if (novoDia === hoje()) novos.delete('dia')
    else novos.set('dia', novoDia)
    const consulta = novos.toString()
    router.push(consulta ? `${caminho}?${consulta}` : caminho)
  }

  return (
    <div className="flex items-center gap-1.5">
      <Botao
        variante="contorno"
        tamanho="icone"
        aria-label="Dia anterior"
        onClick={() => irPara(deslocarDias(dia, -1))}
      >
        <span aria-hidden>‹</span>
      </Botao>

      <Entrada
        type="date"
        value={dia}
        onChange={(evento) => irPara(evento.target.value)}
        aria-label="Dia"
        className="w-auto"
      />

      <Botao
        variante="contorno"
        tamanho="icone"
        aria-label="Dia seguinte"
        onClick={() => irPara(deslocarDias(dia, 1))}
      >
        <span aria-hidden>›</span>
      </Botao>

      {dia !== hoje() ? (
        <Botao variante="fantasma" tamanho="pequeno" onClick={() => irPara(hoje())}>
          Hoje
        </Botao>
      ) : null}
    </div>
  )
}
