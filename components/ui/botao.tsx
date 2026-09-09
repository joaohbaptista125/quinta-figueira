import * as React from 'react'
import { cn } from '@/lib/utils'

const VARIANTES = {
  primario:
    'bg-primary text-primary-foreground hover:opacity-90 active:opacity-100',
  secundario:
    'bg-secondary text-secondary-foreground hover:bg-accent',
  contorno:
    'border border-input bg-card hover:bg-accent hover:text-accent-foreground',
  fantasma: 'hover:bg-accent hover:text-accent-foreground',
  destrutivo:
    'bg-destructive text-destructive-foreground hover:opacity-90',
} as const

const TAMANHOS = {
  normal: 'h-10 px-4 text-sm',
  pequeno: 'h-8 px-3 text-xs',
  grande: 'h-12 px-6 text-base',
  icone: 'h-10 w-10',
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
