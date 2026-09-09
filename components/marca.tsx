import Image from 'next/image'
import lockup from '@/public/marca/logotipo.jpg'
import simbolo from '@/public/marca/simbolo.png'
import { cn } from '@/lib/utils'

/*
 * A marca do clube tem duas peças, e servem para coisas diferentes:
 *
 *   public/marca/logotipo.jpg — o lockup completo, símbolo mais o nome. Usado
 *                               em grande, onde o lettering se lê.
 *   public/marca/simbolo.png  — só a cabeça de cavalo, quadrada. Usado em
 *                               pequeno, onde o lockup vira mancha e repetiria
 *                               o nome que já está escrito ao lado.
 *
 * São importados, não lidos do disco. Uma versão anterior procurava os
 * ficheiros com fs.existsSync() e caía sempre na reserva quando publicada: na
 * Vercel os ficheiros de public/ não entram no pacote da função, vão para o
 * CDN à parte, e a verificação dava falso. Importar resolve-os no momento da
 * compilação, dá ao next/image as dimensões reais, e se um ficheiro faltar o
 * build falha em vez de a marca desaparecer sem se perceber porquê.
 *
 * Para trocar a marca, substitui os ficheiros mantendo os nomes. Se mudares a
 * extensão, muda também a linha do import aqui em cima.
 * `scripts/extrair-simbolo.mjs` gera o símbolo a partir do logótipo.
 */

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

  // Em grande mostra-se o lockup, que já traz o nome — escrevê-lo outra vez
  // por baixo seria dizer a mesma coisa duas vezes.
  const mostrarNome = !semTexto && !grande

  const Sobretitulo = (
    <span
      className={cn(
        'block font-medium uppercase tracking-[0.2em] text-muted-foreground',
        sobretitulo,
      )}
    >
      Centro Hípico
    </span>
  )

  return (
    <span
      className={cn(
        'flex items-center gap-3',
        grande && 'flex-col gap-3 text-center',
        className,
      )}
    >
      {!semTexto && grande ? Sobretitulo : null}

      <Image
        src={grande ? lockup : simbolo}
        alt="Quinta da Figueira"
        width={lado}
        height={lado}
        className={cn('shrink-0 object-cover', grande ? 'rounded-xl' : 'rounded-lg')}
        priority
      />

      {mostrarNome ? (
        <span>
          {Sobretitulo}
          <span className={cn('block font-semibold tracking-tight', texto)}>
            Quinta da Figueira
          </span>
        </span>
      ) : null}
    </span>
  )
}
