import { cn } from '@/lib/utils'
import { Cartao } from '@/components/ui/superficie'

export function Indicador({
  rotulo,
  valor,
  detalhe,
  tom = 'neutro',
}: {
  rotulo: string
  valor: string
  detalhe?: string
  tom?: 'neutro' | 'positivo' | 'negativo'
}) {
  return (
    <Cartao className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <p
        className={cn(
          'tabular mt-1 text-2xl font-semibold tracking-tight',
          tom === 'positivo' && 'text-success',
          tom === 'negativo' && 'text-destructive',
        )}
      >
        {valor}
      </p>
      {detalhe ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{detalhe}</p>
      ) : null}
    </Cartao>
  )
}
