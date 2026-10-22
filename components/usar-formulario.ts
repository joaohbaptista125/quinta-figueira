'use client'

import { useActionState, useEffect, useRef } from 'react'
import { SEM_RESULTADO, type ResultadoAccao } from '@/lib/accoes/resultado'

type Accao = (
  anterior: ResultadoAccao,
  dados: FormData,
) => Promise<ResultadoAccao>

/**
 * Um formulário dentro da página que se limpa depois de gravar.
 * =============================================================================
 *
 * Os formulários que não navegam — publicar um aviso, convocar uma pessoa,
 * registar uma ferração — ficavam com os campos preenchidos depois de gravar.
 * Para quem está do outro lado do ecrã isso lê-se como «não aconteceu nada»,
 * e convida a carregar outra vez no botão: o texto que acabou de ser publicado
 * continua ali, à espera de ser publicado de novo.
 *
 * A seguir a um sucesso: **limpa-se o formulário e devolve-se o foco ao
 * primeiro campo**. São as duas coisas que dizem «pronto, podes escrever o
 * seguinte» sem precisar de uma frase. O foco traz também a página de volta ao
 * sítio onde se estava a trabalhar, que numa ficha comprida é metade do
 * problema.
 *
 * `reset()` devolve cada campo ao seu `defaultValue` — por isso os campos
 * escondidos com o id do evento ou do cavalo sobrevivem, e um selector de
 * método volta à opção por omissão em vez de ficar em branco.
 *
 * Em bloco de caixas de visto que espelham o estado do servidor (as presenças)
 * **não se usa isto**: `reset()` devolveria as marcas ao que estavam antes de
 * gravar, e durante um instante o ecrã mostrava o contrário do que acabou de
 * acontecer.
 */
export function useFormularioDeAccao(
  accao: Accao,
  opcoes?: {
    /** Devolver o foco ao primeiro campo. Desliga-se onde não há o que escrever a seguir. */
    focar?: boolean
  },
) {
  const [resultado, executar, pendente] = useActionState(accao, SEM_RESULTADO)
  const formulario = useRef<HTMLFormElement>(null)
  const focar = opcoes?.focar ?? true

  useEffect(() => {
    // `SEM_RESULTADO` é `ok: false`, por isso isto não corre ao montar.
    if (!resultado.ok) return

    formulario.current?.reset()
    if (!focar) return

    // Escondidos, ficheiros, rádios e caixas de visto ficam de fora: o foco
    // tem de cair onde se escreve ou se escolhe, não numa pastilha.
    const primeiro = formulario.current?.querySelector<HTMLElement>(
      'input:not([type=hidden]):not([type=file]):not([type=radio]):not([type=checkbox]), select, textarea',
    )
    primeiro?.focus()
  }, [resultado, focar])

  return { resultado, executar, pendente, formulario }
}
