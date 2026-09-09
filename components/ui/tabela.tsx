import * as React from 'react'
import { cn } from '@/lib/utils'

/** Tabela com scroll horizontal próprio — o corpo da página nunca desliza. */
export function Tabela({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
}

export function Cabecalho({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('border-b border-border bg-muted/60', className)}
      {...props}
    />
  )
}

export function Corpo({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
  )
}

export function Linha({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-b border-border transition-colors hover:bg-muted/50',
        className,
      )}
      {...props}
    />
  )
}

export function Th({
  className,
  numerico,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numerico?: boolean }) {
  return (
    <th
      className={cn(
        'px-3 py-2.5 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground',
        numerico && 'text-right',
        className,
      )}
      {...props}
    />
  )
}

export function Td({
  className,
  numerico,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numerico?: boolean }) {
  return (
    <td
      className={cn(
        'px-3 py-2.5 align-middle',
        numerico && 'tabular text-right',
        className,
      )}
      {...props}
    />
  )
}
