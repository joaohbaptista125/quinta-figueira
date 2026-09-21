'use client'

import { useState } from 'react'
import { Entrada, Selector } from '@/components/ui/campos'
import { VALOR_NOVA } from '@/lib/opcoes-cavalo'

/**
 * Lista de opções com uma saída para escrever uma nova.
 *
 * A lista não pode ser fechada — aparece sempre uma raça que ninguém tinha
 * previsto — mas também não pode ser texto livre, senão o mesmo lusitano
 * acaba escrito de quatro maneiras. Daí a última opção abrir uma caixa de
 * texto; o que lá for escrito passa a fazer parte da lista quando o cavalo
 * for gravado.
 *
 * O valor escolhido viaja em `name` e o escrito à mão em `name_nova`. Quem lê
 * do lado do servidor é `opcaoOuNova()` em `lib/accoes/cavalos.ts`.
 */
export function SelectorComOutro({
  id,
  name,
  opcoes,
  valorInicial,
  rotuloNova,
  exemplo,
}: {
  id: string
  name: string
  opcoes: string[]
  valorInicial?: string | null
  /** Texto da última opção, p. ex. «Outra raça — escrever…». */
  rotuloNova: string
  /** Exemplo mostrado na caixa de texto. */
  exemplo?: string
}) {
  // Um cavalo gravado antes desta lista existir pode ter um valor que não
  // está lá. Não se perde: abre já na caixa de texto, com ele escrito.
  const foraDaLista =
    valorInicial && !opcoes.includes(valorInicial) ? valorInicial : ''
  const [escolha, setEscolha] = useState(
    foraDaLista ? VALOR_NOVA : (valorInicial ?? ''),
  )

  return (
    <div className="space-y-2">
      <Selector
        id={id}
        name={name}
        value={escolha}
        onChange={(evento) => setEscolha(evento.target.value)}
      >
        <option value="">—</option>
        {opcoes.map((opcao) => (
          <option key={opcao} value={opcao}>
            {opcao}
          </option>
        ))}
        <option value={VALOR_NOVA}>{rotuloNova}</option>
      </Selector>

      {escolha === VALOR_NOVA ? (
        <Entrada
          name={`${name}_nova`}
          defaultValue={foraDaLista}
          placeholder={exemplo}
          aria-label={rotuloNova}
          autoComplete="off"
          required
        />
      ) : null}
    </div>
  )
}
