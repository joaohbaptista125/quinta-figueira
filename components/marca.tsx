import fs from 'node:fs'
import path from 'node:path'
import Image from 'next/image'
import { cn } from '@/lib/utils'

const FICHEIRO_LOGOTIPO = 'marca/logotipo.png'

/*
 * Basta pôr o ficheiro em public/marca/logotipo.png e ele passa a aparecer em
 * todo o lado — não é preciso mexer em código. Enquanto não existir, fica a
 * ferradura desenhada aqui, com a mesma forma e o mesmo tamanho, para o
 * arranjo da página não dar um salto quando o logótipo entrar.
 *
 * A verificação corre uma vez por processo: os ficheiros de public/ não mudam
 * entre pedidos, mudam entre deployments.
 */
const TEM_LOGOTIPO = fs.existsSync(
  path.join(process.cwd(), 'public', FICHEIRO_LOGOTIPO),
)

const TAMANHOS = {
  compacto: { lado: 36, texto: 'text-base', sobretitulo: 'text-[0.6rem]' },
  grande: { lado: 84, texto: 'text-2xl', sobretitulo: 'text-xs' },
} as const

export function Marca({
  tamanho = 'compacto',
  semTexto,
  className,
}: {
  tamanho?: keyof typeof TAMANHOS
  /** Só o símbolo, sem o nome ao lado. */
  semTexto?: boolean
  className?: string
}) {
  const { lado, texto, sobretitulo } = TAMANHOS[tamanho]
  const vertical = tamanho === 'grande'

  return (
    <span
      className={cn(
        'flex items-center gap-3',
        vertical && 'flex-col gap-2 text-center',
        className,
      )}
    >
      <Simbolo lado={lado} />

      {semTexto ? null : (
        <span className={cn(vertical && 'flex flex-col items-center')}>
          <span
            className={cn(
              'block font-medium uppercase tracking-[0.2em] text-muted-foreground',
              sobretitulo,
            )}
          >
            Centro Hípico
          </span>
          <span className={cn('block font-semibold tracking-tight', texto)}>
            Quinta da Figueira
          </span>
        </span>
      )}
    </span>
  )
}

function Simbolo({ lado }: { lado: number }) {
  if (TEM_LOGOTIPO) {
    return (
      <Image
        src={`/${FICHEIRO_LOGOTIPO}`}
        alt="Quinta da Figueira"
        width={lado}
        height={lado}
        className="shrink-0 rounded-lg object-cover"
        priority
      />
    )
  }

  // Reserva com a forma do logótipo: quadrado verde, desenho a creme.
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-content-center rounded-lg bg-primary"
      style={{ width: lado, height: lado }}
    >
      <svg
        width={lado * 0.62}
        height={lado * 0.62}
        viewBox="0 0 100 100"
        className="text-primary-foreground"
      >
        <circle
          cx="50"
          cy="50"
          r="35"
          fill="none"
          stroke="currentColor"
          strokeWidth="17"
          strokeLinecap="round"
          strokeDasharray="189 31"
          transform="rotate(115 50 50)"
        />
      </svg>
    </span>
  )
}
