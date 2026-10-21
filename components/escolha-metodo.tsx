'use client'

import { ROTULOS_METODO } from '@/lib/rotulos'
import type { MetodoPagamento } from '@/lib/tipos-bd'

/**
 * Ordem dos métodos, a mais usada primeiro.
 *
 * Não é a ordem do enum: na cavalariça paga-se por transferência, MB Way ou
 * dinheiro, e são esses três que têm de estar no primeiro toque. Os outros
 * ficam a seguir porque existem e têm de poder ser escolhidos.
 */
export const ORDEM_METODOS: MetodoPagamento[] = [
  'transferencia',
  'mbway',
  'dinheiro',
  'multibanco',
  'cheque',
  'debito_directo',
]

/**
 * Método de pagamento em pastilhas, não numa lista pendente.
 *
 * São `<input type="radio">` normais escondidos por baixo da pastilha: um
 * toque escolhe, funciona sem JavaScript, e o teclado e os leitores de ecrã
 * continuam a ver um grupo de opções.
 *
 * Os radios agrupam-se por nome dentro do mesmo `<form>`, e cada painel de
 * pagamento é um formulário — por isso podem partilhar o nome sem colidir.
 */
export function EscolhaMetodo({
  omissao,
  legenda = 'Como foi pago',
}: {
  omissao: MetodoPagamento
  legenda?: string
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{legenda}</legend>
      <div className="flex flex-wrap gap-1.5">
        {ORDEM_METODOS.map((metodo) => (
          <label key={metodo} className="cursor-pointer">
            <input
              type="radio"
              name="metodo_pagamento"
              value={metodo}
              defaultChecked={metodo === omissao}
              className="peer sr-only"
            />
            <span
              className={
                'inline-flex items-center rounded-full border border-input px-3.5 py-1.5 text-sm transition-colors ' +
                'hover:bg-accent peer-checked:border-primary peer-checked:bg-primary ' +
                'peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring'
              }
            >
              {ROTULOS_METODO[metodo]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
