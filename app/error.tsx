'use client'

import { useEffect } from 'react'
import { Botao } from '@/components/ui/botao'

/**
 * O que se mostra quando alguma coisa rebenta a sério.
 *
 * **Mostra o erro, e não só uma referência.** Durante muito tempo mostrava
 * «Alguma coisa correu mal» e um `digest` — e isso é inútil das duas maneiras:
 * quem está do outro lado não sabe o que lhe fazer, e quem o pode arranjar
 * também não, porque o `digest` só serve para procurar nos registos do
 * servidor — que no plano Hobby duram **uma hora** e, quando o erro é do lado
 * do browser, nem sequer existem. Foi exactamente o que aconteceu com a ficha
 * de uma equipa: nenhum registo, nenhuma pista, e a causa a ser deduzida.
 *
 * Em produção o Next **apaga a mensagem dos erros do servidor** e deixa só o
 * `digest` — por isso o que aqui aparecer já diz de que lado foi: uma
 * mensagem verdadeira é do browser; a frase genérica do Next é do servidor, e
 * aí o que vale é a referência.
 *
 * Fica fechado num `<details>` para não assustar quem só quer tentar de novo.
 */
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold">Alguma coisa correu mal</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Tente de novo. Se voltar a acontecer, abra o detalhe aqui em baixo e
        envie-o a quem gere a aplicação — é o que permite perceber a causa.
      </p>

      <details className="mt-1 w-full max-w-md text-left text-sm">
        <summary className="cursor-pointer text-center text-muted-foreground">
          Detalhe técnico
        </summary>
        <dl className="mt-2 space-y-1 rounded-md bg-muted p-3 text-xs">
          {error.name ? <Linha rotulo="Tipo" valor={error.name} /> : null}
          <Linha rotulo="Mensagem" valor={error.message || '(sem mensagem)'} />
          {error.digest ? (
            <Linha rotulo="Referência" valor={error.digest} />
          ) : null}
        </dl>
      </details>

      <Botao onClick={reset} variante="contorno" className="mt-2">
        Tentar de novo
      </Botao>
    </main>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 font-medium">{rotulo}:</dt>
      <dd className="break-all font-mono">{valor}</dd>
    </div>
  )
}
