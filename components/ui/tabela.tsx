import * as React from 'react'
import Link from 'next/link'
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
        // `relative` é o que permite a <LigacaoFicha> esticar-se por cima da
        // linha toda. Sem isto, só o texto do nome seria clicável.
        'relative border-b border-border transition-colors hover:bg-muted/50',
        'has-[a.ficha:focus-visible]:bg-muted/50',
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

/**
 * Ligação para a ficha de um registo, a partir de uma linha de listagem.
 *
 * O `after:absolute after:inset-0` estica a área clicável a toda a linha,
 * mantendo uma única ligação real — o que preserva o nome acessível, o foco
 * pelo teclado e o «abrir em nova janela». Antes disto só o texto do nome
 * respondia ao clique, e como só ganhava sublinhado ao passar o rato, num
 * telemóvel era impossível de descobrir.
 *
 * Outras ligações dentro da mesma linha precisam de <LigacaoInterna>, senão
 * ficam por baixo desta.
 */
export function LigacaoFicha({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        'ficha font-medium text-primary underline-offset-4 hover:underline',
        'after:absolute after:inset-0 after:content-[""]',
        'focus-visible:outline-none',
        className,
      )}
    >
      {children}
    </Link>
  )
}

/** Ligação secundária dentro de uma linha que já tem uma <LigacaoFicha>. */
export function LigacaoInterna({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        'relative z-[1] underline-offset-2 hover:underline',
        className,
      )}
    >
      {children}
    </Link>
  )
}

/** Seta ao fim da linha, para se perceber que a linha abre alguma coisa. */
export function SetaFicha() {
  return (
    <span aria-hidden className="block text-right text-muted-foreground/60">
      ›
    </span>
  )
}
