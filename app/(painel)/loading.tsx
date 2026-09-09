import { Cartao } from '@/components/ui/superficie'

/**
 * Esqueleto mostrado enquanto a página seguinte é gerada no servidor.
 *
 * Sem isto, o Next fica na página anterior até o servidor responder e o clique
 * parece não ter sido registado. Também é o que o Next envia ao pré-carregar
 * as ligações da navegação, por isso mudar de secção passa a ser imediato.
 */
export default function AGerar() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="A carregar">
      <div className="mb-5 space-y-2">
        <div className="h-7 w-52 rounded bg-muted" />
        <div className="h-4 w-72 rounded bg-muted/70" />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Cartao key={i} className="p-4">
            <div className="h-3 w-24 rounded bg-muted/70" />
            <div className="mt-2 h-7 w-28 rounded bg-muted" />
          </Cartao>
        ))}
      </div>

      <Cartao className="overflow-hidden">
        <div className="border-b border-border bg-muted/60 px-3 py-3">
          <div className="h-3 w-40 rounded bg-muted" />
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-3 py-3.5 last:border-0"
          >
            <div className="h-4 flex-1 rounded bg-muted/70" />
            <div className="h-4 w-24 rounded bg-muted/50" />
            <div className="h-4 w-20 rounded bg-muted/50" />
          </div>
        ))}
      </Cartao>
    </div>
  )
}
