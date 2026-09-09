import * as React from 'react'
import { cn } from '@/lib/utils'

const BASE_CAMPO = cn(
  'w-full rounded-md border border-input bg-card px-3 py-2 text-sm',
  'placeholder:text-muted-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring',
  'disabled:cursor-not-allowed disabled:opacity-50',
)

export function Entrada({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(BASE_CAMPO, 'h-10', className)} {...props} />
}

export function AreaTexto({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(BASE_CAMPO, 'min-h-20', className)} {...props} />
}

/**
 * <select> nativo de propósito: no telemóvel abre o selector do sistema, que é
 * bem mais rápido para digitação em série do que um dropdown personalizado.
 */
export function Selector({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(BASE_CAMPO, 'h-10 appearance-none bg-no-repeat pr-8', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.5'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.6rem center',
        backgroundSize: '1rem',
      }}
      {...props}
    />
  )
}

export function Etiqueta({
  className,
  obrigatorio,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { obrigatorio?: boolean }) {
  return (
    <label
      className={cn('text-sm font-medium text-foreground', className)}
      {...props}
    >
      {children}
      {obrigatorio ? <span className="ml-0.5 text-destructive">*</span> : null}
    </label>
  )
}

/** Rótulo + campo + ajuda/erro, com o `for`/`id` já ligados. */
export function Campo({
  etiqueta,
  htmlFor,
  obrigatorio,
  ajuda,
  erro,
  className,
  children,
}: {
  etiqueta: string
  htmlFor: string
  obrigatorio?: boolean
  ajuda?: React.ReactNode
  erro?: string | null
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Etiqueta htmlFor={htmlFor} obrigatorio={obrigatorio}>
        {etiqueta}
      </Etiqueta>
      {children}
      {erro ? (
        <p className="text-xs text-destructive">{erro}</p>
      ) : ajuda ? (
        <p className="text-xs text-muted-foreground">{ajuda}</p>
      ) : null}
    </div>
  )
}

export function Caixa({
  className,
  etiqueta,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { etiqueta: string }) {
  const id = props.id ?? props.name
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        className={cn(
          'size-4 rounded border-input accent-[var(--primary)]',
          className,
        )}
        {...props}
      />
      <Etiqueta htmlFor={id} className="cursor-pointer font-normal">
        {etiqueta}
      </Etiqueta>
    </div>
  )
}
