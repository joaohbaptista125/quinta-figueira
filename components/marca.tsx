import fs from 'node:fs'
import path from 'node:path'
import Image from 'next/image'
import { cn } from '@/lib/utils'

/*
 * A marca do clube tem duas peças, e servem para coisas diferentes:
 *
 *   public/marca/logotipo.*  — o lockup completo, símbolo mais o nome. Usado
 *                              em grande, onde o lettering se lê.
 *   public/marca/simbolo.*   — só a cabeça de cavalo, quadrada. Usado em
 *                              pequeno, onde o lockup vira mancha e repetiria
 *                              o nome que já está escrito ao lado.
 *
 * Basta pôr os ficheiros lá e passam a aparecer — não é preciso mexer em
 * código. Sem eles fica uma ferradura desenhada aqui, com a mesma forma e
 * tamanho, para o arranjo não dar um salto quando entrarem.
 * `scripts/extrair-simbolo.mjs` gera o símbolo a partir do logótipo.
 *
 * A procura corre uma vez por processo: os ficheiros de public/ não mudam
 * entre pedidos, mudam entre deployments.
 */
const EXTENSOES = ['png', 'jpg', 'jpeg', 'webp', 'svg'] as const

function procurar(base: string) {
  return (
    EXTENSOES.map((extensao) => `marca/${base}.${extensao}`).find((relativo) =>
      fs.existsSync(path.join(process.cwd(), 'public', relativo)),
    ) ?? null
  )
}

const LOCKUP = procurar('logotipo')
const SIMBOLO = procurar('simbolo') ?? LOCKUP

const TAMANHOS = {
  compacto: { lado: 34, texto: 'text-base', sobretitulo: 'text-[0.6rem]' },
  grande: { lado: 132, texto: 'text-2xl', sobretitulo: 'text-xs' },
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
  const grande = tamanho === 'grande'

  // Em grande, o lockup já traz o nome — escrevê-lo outra vez por baixo seria
  // dizer a mesma coisa duas vezes.
  const nomeNaImagem = grande && LOCKUP !== null
  const mostrarNome = !semTexto && !nomeNaImagem

  return (
    <span
      className={cn(
        'flex items-center gap-3',
        grande && 'flex-col gap-3 text-center',
        className,
      )}
    >
      {!semTexto && grande ? (
        <span
          className={cn(
            'block font-medium uppercase tracking-[0.2em] text-muted-foreground',
            sobretitulo,
          )}
        >
          Centro Hípico
        </span>
      ) : null}

      {nomeNaImagem ? (
        <Image
          src={`/${LOCKUP}`}
          alt="Quinta da Figueira"
          width={lado}
          height={lado}
          className="shrink-0 rounded-xl"
          priority
        />
      ) : (
        <Simbolo lado={lado} />
      )}

      {mostrarNome ? (
        <span className={cn(grande && 'flex flex-col items-center')}>
          {!grande ? (
            <span
              className={cn(
                'block font-medium uppercase tracking-[0.2em] text-muted-foreground',
                sobretitulo,
              )}
            >
              Centro Hípico
            </span>
          ) : null}
          <span className={cn('block font-semibold tracking-tight', texto)}>
            Quinta da Figueira
          </span>
        </span>
      ) : null}
    </span>
  )
}

function Simbolo({ lado }: { lado: number }) {
  if (SIMBOLO) {
    return (
      <Image
        src={`/${SIMBOLO}`}
        alt="Quinta da Figueira"
        width={lado}
        height={lado}
        className="shrink-0 rounded-lg object-cover"
        priority
      />
    )
  }

  // Reserva com a forma do símbolo: quadrado verde, desenho a creme.
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
