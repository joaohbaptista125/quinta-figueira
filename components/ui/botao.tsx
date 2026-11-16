import * as React from 'react'
import { cn } from '@/lib/utils'

/*
 * `active:` não é enfeite: **num ecrã de toque não há `hover`**, e sem estado
 * de pressão um toque não mostra absolutamente nada até a página seguinte
 * chegar. Com o arranque a frio da Vercel isso são segundos a olhar para um
 * botão que não reagiu — e quem está do outro lado toca outra vez.
 */
const VARIANTES = {
  primario:
    'bg-primary text-primary-foreground hover:opacity-90 active:opacity-80',
  secundario:
    'bg-secondary text-secondary-foreground hover:bg-accent active:bg-accent',
  contorno:
    'border border-input bg-card hover:bg-accent hover:text-accent-foreground active:bg-accent',
  fantasma: 'hover:bg-accent hover:text-accent-foreground active:bg-accent',
  destrutivo:
    'bg-destructive text-destructive-foreground hover:opacity-90 active:opacity-80',
} as const

/*
 * **44px é o mínimo num ecrã de toque**, e é a mesma história do `text-base`
 * nos campos: o que serve o rato não serve o dedo. `h-8` são 32px — num
 * telemóvel, dentro da cavalariça e muitas vezes com luvas, é um alvo que se
 * falha. `pointer-coarse:` levanta todos os tamanhos ao mínimo sem engordar
 * a interface de quem usa o computador no escritório.
 *
 * O `px` sobe junto: um botão alto e estreito fica com ar de engano.
 */
const TAMANHOS = {
  normal: 'h-10 pointer-coarse:h-11 px-4 text-sm',
  pequeno: 'h-8 pointer-coarse:h-11 px-3 pointer-coarse:px-4 text-xs pointer-coarse:text-sm',
  grande: 'h-12 px-6 text-base',
  icone: 'h-10 w-10 pointer-coarse:size-11',
} as const

export type VarianteBotao = keyof typeof VARIANTES
export type TamanhoBotao = keyof typeof TAMANHOS

export type PropsBotao = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBotao
  tamanho?: TamanhoBotao
}

export function Botao({
  className,
  variante = 'primario',
  tamanho = 'normal',
  type = 'button',
  ...props
}: PropsBotao) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
        '[&_svg]:size-4 [&_svg]:shrink-0',
        VARIANTES[variante],
        TAMANHOS[tamanho],
        className,
      )}
      {...props}
    />
  )
}

/** Mesmas classes do botão, para usar em <Link> ou <a>. */
export function classesBotao(
  variante: VarianteBotao = 'primario',
  tamanho: TamanhoBotao = 'normal',
  className?: string,
) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap',
    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    VARIANTES[variante],
    TAMANHOS[tamanho],
    className,
  )
}
