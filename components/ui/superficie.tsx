import * as React from 'react'
import { cn } from '@/lib/utils'

export function Cartao({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  )
}

export function CabecalhoCartao({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-1 p-4 sm:p-5', className)} {...props} />
}

export function TituloCartao({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('text-base font-semibold tracking-tight', className)}
      {...props}
    />
  )
}

export function DescricaoCartao({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
}

export function ConteudoCartao({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 pt-0 sm:p-5 sm:pt-0', className)} {...props} />
}

const CORES_DISTINTIVO = {
  neutro: 'bg-muted text-muted-foreground',
  primario: 'bg-primary/12 text-primary',
  sucesso: 'bg-success/15 text-success',
  aviso: 'bg-warning/20 text-warning-foreground',
  perigo: 'bg-destructive/12 text-destructive',
} as const

export function Distintivo({
  cor = 'neutro',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  cor?: keyof typeof CORES_DISTINTIVO
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        CORES_DISTINTIVO[cor],
        className,
      )}
      {...props}
    />
  )
}

const CORES_AVISO = {
  info: 'border-border bg-muted text-foreground',
  sucesso: 'border-success/30 bg-success/10 text-foreground',
  erro: 'border-destructive/30 bg-destructive/10 text-foreground',
  atencao: 'border-warning/40 bg-warning/12 text-foreground',
} as const

export function Aviso({
  tom = 'info',
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tom?: keyof typeof CORES_AVISO }) {
  return (
    <div
      role={tom === 'erro' ? 'alert' : 'status'}
      className={cn(
        'rounded-md border px-3 py-2 text-sm',
        CORES_AVISO[tom],
        className,
      )}
      {...props}
    />
  )
}

/** Estado vazio de uma listagem. */
export function SemRegistos({
  titulo,
  descricao,
  accao,
}: {
  titulo: string
  descricao?: string
  accao?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="font-medium">{titulo}</p>
      {descricao ? (
        <p className="max-w-sm text-sm text-muted-foreground">{descricao}</p>
      ) : null}
      {accao ? <div className="mt-2">{accao}</div> : null}
    </div>
  )
}
