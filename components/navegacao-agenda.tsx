'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Botao } from '@/components/ui/botao'
import { Entrada } from '@/components/ui/campos'
import { cn } from '@/lib/utils'
import { deslocarDias, deslocarMeses, hoje, primeiroDiaDoMes } from '@/lib/formatos'

export type VistaAgenda = 'mes' | 'semana' | 'dia'

export const VISTAS: { valor: VistaAgenda; rotulo: string }[] = [
  { valor: 'mes', rotulo: 'Mês' },
  { valor: 'semana', rotulo: 'Semana' },
  { valor: 'dia', rotulo: 'Dia' },
]

/** Quanto anda o ‹ › em cada vista. */
function deslocar(vista: VistaAgenda, dia: string, sentido: 1 | -1) {
  if (vista === 'mes') {
    return deslocarMeses(primeiroDiaDoMes(dia), sentido)
  }
  return deslocarDias(dia, vista === 'semana' ? 7 * sentido : sentido)
}

/**
 * Setas, salto por data, «Hoje» e a escolha da vista.
 *
 * O dia escolhido viaja em `?dia=`, e é sempre um dia — também na vista de mês
 * e de semana, onde serve para dizer qual. Assim mudar de vista não perde o
 * sítio onde se estava: passar de Outubro para «Semana» abre a semana do dia
 * que estava seleccionado, e não a de hoje.
 */
export function NavegacaoAgenda({
  vista,
  dia,
}: {
  vista: VistaAgenda
  dia: string
}) {
  const router = useRouter()
  const caminho = usePathname()
  const parametros = useSearchParams()

  function endereco(novaVista: VistaAgenda, novoDia: string) {
    const novos = new URLSearchParams(parametros.toString())

    if (novaVista === 'mes') novos.delete('vista')
    else novos.set('vista', novaVista)

    if (novoDia === hoje()) novos.delete('dia')
    else novos.set('dia', novoDia)

    const consulta = novos.toString()
    return consulta ? `${caminho}?${consulta}` : caminho
  }

  const irPara = (novoDia: string) => router.push(endereco(vista, novoDia))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        <Botao
          variante="contorno"
          tamanho="icone"
          aria-label="Anterior"
          onClick={() => irPara(deslocar(vista, dia, -1))}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Botao>

        <Entrada
          type="date"
          value={dia}
          onChange={(evento) => {
            if (evento.target.value) irPara(evento.target.value)
          }}
          aria-label="Ir para a data"
          className="w-auto"
        />

        <Botao
          variante="contorno"
          tamanho="icone"
          aria-label="Seguinte"
          onClick={() => irPara(deslocar(vista, dia, 1))}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Botao>

        {dia !== hoje() ? (
          <Botao variante="fantasma" tamanho="pequeno" onClick={() => irPara(hoje())}>
            Hoje
          </Botao>
        ) : null}
      </div>

      <div
        role="group"
        aria-label="Vista"
        className="flex rounded-md border border-input p-0.5"
      >
        {VISTAS.map(({ valor, rotulo }) => (
          <Link
            key={valor}
            href={endereco(valor, dia)}
            aria-current={valor === vista ? 'true' : undefined}
            replace
            className={cn(
              'rounded px-3 py-1.5 text-sm transition-colors',
              valor === vista
                ? 'bg-primary font-medium text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            {rotulo}
          </Link>
        ))}
      </div>
    </div>
  )
}
