'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { SmilePlus, X } from 'lucide-react'
import { alternarReaccao } from '@/lib/accoes/eventos'
import {
  EMOJIS_COMUNS,
  alternarNaLista,
  type ReaccaoAgrupada,
} from '@/lib/reaccoes'
import { cn } from '@/lib/utils'

/**
 * As reacções de uma mensagem do chat.
 *
 * Três coisas que não se mexem sem pensar:
 *
 *   * **O ecrã muda no toque, não na resposta.** `useOptimistic` sobre
 *     `alternarNaLista` — que é uma função pura e testada precisamente por
 *     ser ela que decide o que se vê nesse instante. Uma reacção que só
 *     aparecesse depois da ida ao servidor era pior do que não haver
 *     reacções: com o arranque a frio, são segundos a olhar para um emoji
 *     que não reagiu, e o dedo volta a tocar.
 *   * **A mesma pastilha dá e tira.** Carregar outra vez desfaz, e é por
 *     isso que leva `aria-pressed` — para quem usa leitor de ecrã ouvir o
 *     estado e não só o emoji.
 *   * **44px no ecrã de toque**, como tudo o resto. Uma pastilha de contagem
 *     é pequena por natureza, e é das coisas que mais se tocam.
 *
 * Não manda notificação nenhuma, de propósito — ver a migração.
 */
export function Reaccoes({
  avisoId,
  reaccoes,
  meuNome,
  caminho,
  podeReagir,
}: {
  avisoId: string
  reaccoes: ReaccaoAgrupada[]
  /** Para a contagem optimista saber quem acrescentar à lista de nomes. */
  meuNome: string
  /** O que revalidar depois de gravar. */
  caminho: string
  podeReagir: boolean
}) {
  const [optimistas, aplicar] = useOptimistic(
    reaccoes,
    (actuais: ReaccaoAgrupada[], emoji: string) =>
      alternarNaLista(actuais, emoji, meuNome),
  )
  const [, comecar] = useTransition()
  const [aberto, abrir] = useState(false)

  function reagir(emoji: string) {
    abrir(false)
    comecar(async () => {
      aplicar(emoji)
      await alternarReaccao(avisoId, emoji, caminho)
    })
  }

  if (!podeReagir && optimistas.length === 0) return null

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex flex-wrap items-center gap-1">
      {optimistas.map((reaccao) => (
        <button
          key={reaccao.emoji}
          type="button"
          onClick={() => reagir(reaccao.emoji)}
          disabled={!podeReagir}
          aria-pressed={reaccao.minha}
          title={reaccao.nomes.join(', ')}
          className={cn(
            'inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs',
            'pointer-coarse:h-11 pointer-coarse:px-3 pointer-coarse:text-sm',
            'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:pointer-events-none',
            reaccao.minha
              ? 'border-primary bg-primary/15 font-medium'
              : 'border-border bg-card hover:bg-accent active:bg-accent',
          )}
        >
          <span aria-hidden>{reaccao.emoji}</span>
          <span className="tabular-nums">{reaccao.nomes.length}</span>
          <span className="sr-only">
            {reaccao.nomes.length === 1 ? 'pessoa reagiu' : 'pessoas reagiram'}{' '}
            com este emoji
            {reaccao.minha ? ', eu incluído' : ''}
          </span>
        </button>
      ))}

      {podeReagir ? (
        <>
          <button
            type="button"
            onClick={() => abrir(!aberto)}
            aria-expanded={aberto}
            aria-label={aberto ? 'Fechar os emojis' : 'Reagir a esta mensagem'}
            className={cn(
              'inline-flex size-7 items-center justify-center rounded-full border border-dashed border-border',
              'pointer-coarse:size-11 text-muted-foreground',
              'transition-colors hover:bg-accent hover:text-foreground active:bg-accent',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            {aberto ? (
              <X className="size-3.5 pointer-coarse:size-4" />
            ) : (
              <SmilePlus className="size-3.5 pointer-coarse:size-4" />
            )}
          </button>

          {aberto
            ? EMOJIS_COMUNS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => reagir(emoji)}
                  aria-label={`Reagir com ${emoji}`}
                  className={cn(
                    'inline-flex size-7 items-center justify-center rounded-full text-sm',
                    'pointer-coarse:size-11 pointer-coarse:text-lg',
                    'transition-colors hover:bg-accent active:bg-accent',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  {emoji}
                </button>
              ))
            : null}
        </>
      ) : null}
      </div>

      {/*
        * **Os nomes de quem reagiu ficam à vista, e não só no `title`.**
        * O `title` é uma dica de rato, e esta aplicação usa-se de telemóvel
        * dentro da cavalariça — num ecrã de toque não há lá maneira nenhuma
        * de a ler. E tocar na pastilha não serve para ver: tocar **dá e tira**
        * a reacção, por isso quem fosse ver quem reagiu acabava a reagir
        * também.
        *
        * Fica tudo, sem cortes: numa equipa de uma dúzia de pessoas a lista é
        * curta, e «e mais 3» obrigava a um segundo toque para responder à
        * única pergunta que a linha existe para responder.
        */}
      {optimistas.length > 0 ? (
        <p className="text-xs leading-snug text-muted-foreground">
          {optimistas.map((reaccao, indice) => (
            <span key={reaccao.emoji}>
              {indice > 0 ? ' · ' : ''}
              {reaccao.emoji} {reaccao.nomes.join(', ')}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  )
}
