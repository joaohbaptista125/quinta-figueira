'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { largarNoPaddock, recolherDoPaddock } from '@/lib/accoes/paddocks'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { Selector } from '@/components/ui/campos'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  Distintivo,
  TituloCartao,
} from '@/components/ui/superficie'

export type CavaloLargado = {
  /** O id da ocupação, não o do cavalo: é o que se apaga ao recolher. */
  id: string
  cavalo_id: string
  nome: string
}

export type CampoDeLargada = {
  id: string
  numero: number
  nome: string | null
  cavalos: CavaloLargado[]
}

/**
 * O quadro de hoje: oito campos, e quem está em cada um.
 * =============================================================================
 *
 * É a pergunta de quem chega de manhã — **quem já saiu, e para onde** — e
 * fazia-se de cabeça entre tratadores. Por isso o ecrã é um quadro e não uma
 * listagem com filtros: vê-se tudo de uma vez, incluindo os campos vazios, que
 * é o que diz onde ainda cabe um cavalo.
 *
 * Esvazia-se sozinho à meia-noite, porque a ocupação é por dia. Não há aqui
 * nenhum «ver outro dia»: o pedido foi só hoje, e um selector de datas convida
 * a escrever no dia errado.
 */
export function QuadroPaddocks({
  campos,
  disponiveis,
  podeEscrever,
}: {
  campos: CampoDeLargada[]
  /** Cavalos activos que ainda não estão em campo nenhum hoje. */
  disponiveis: { id: string; nome: string }[]
  podeEscrever: boolean
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {campos.map((campo) => (
        <Cartao key={campo.id} className="flex flex-col">
          <CabecalhoCartao className="flex flex-row items-baseline justify-between gap-2">
            <TituloCartao className="text-base">
              Paddock {campo.numero}
              {campo.nome ? (
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  {campo.nome}
                </span>
              ) : null}
            </TituloCartao>
            {campo.cavalos.length > 0 ? (
              <Distintivo cor="informacao">{campo.cavalos.length}</Distintivo>
            ) : null}
          </CabecalhoCartao>

          <ConteudoCartao className="flex flex-1 flex-col gap-2">
            {campo.cavalos.length > 0 ? (
              <ul className="divide-y divide-border rounded-md border border-border">
                {campo.cavalos.map((cavalo) => (
                  <li
                    key={cavalo.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm"
                  >
                    <span className="font-medium">{cavalo.nome}</span>
                    {podeEscrever ? <Recolher id={cavalo.id} /> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-md border border-dashed border-border px-2.5 py-3 text-center text-sm text-muted-foreground">
                Vazio
              </p>
            )}

            {podeEscrever ? (
              <Largar paddockId={campo.id} disponiveis={disponiveis} />
            ) : null}
          </ConteudoCartao>
        </Cartao>
      ))}
    </div>
  )
}

function Recolher({ id }: { id: string }) {
  const [resultado, executar] = useActionState(recolherDoPaddock, SEM_RESULTADO)

  return (
    <form action={executar} className="flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <BotaoRecolher />
      {resultado.mensagem && !resultado.ok ? (
        <span className="text-xs text-destructive">{resultado.mensagem}</span>
      ) : null}
    </form>
  )
}

function BotaoRecolher() {
  const { pending } = useFormStatus()
  return (
    <Botao type="submit" variante="fantasma" tamanho="pequeno" disabled={pending}>
      {pending ? '…' : 'Recolher'}
    </Botao>
  )
}

/**
 * Largar um cavalo neste campo.
 *
 * A lista só traz os cavalos que não estão em campo nenhum hoje — um cavalo
 * não está em dois sítios ao mesmo tempo, e a base recusa-o de qualquer
 * maneira. Oferecê-lo seria dar um botão que só sabe dar erro.
 */
function Largar({
  paddockId,
  disponiveis,
}: {
  paddockId: string
  disponiveis: { id: string; nome: string }[]
}) {
  const [resultado, executar] = useActionState(largarNoPaddock, SEM_RESULTADO)

  if (disponiveis.length === 0) {
    return (
      <p className="mt-auto pt-1 text-xs text-muted-foreground">
        Estão todos os cavalos largados.
      </p>
    )
  }

  return (
    <form action={executar} className="mt-auto flex flex-col gap-2 pt-1">
      <input type="hidden" name="paddock_id" value={paddockId} />
      <Selector name="cavalo_id" defaultValue="" required aria-label="Cavalo a largar">
        <option value="" disabled>
          Largar um cavalo…
        </option>
        {disponiveis.map((cavalo) => (
          <option key={cavalo.id} value={cavalo.id}>
            {cavalo.nome}
          </option>
        ))}
      </Selector>
      <BotaoLargar />
      {resultado.mensagem && !resultado.ok ? (
        <span className="text-xs text-destructive">{resultado.mensagem}</span>
      ) : null}
    </form>
  )
}

function BotaoLargar() {
  const { pending } = useFormStatus()
  return (
    <Botao type="submit" variante="secundario" tamanho="pequeno" disabled={pending}>
      {pending ? 'A largar…' : 'Largar'}
    </Botao>
  )
}
