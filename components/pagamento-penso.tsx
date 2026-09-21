'use client'

import { useActionState, useId } from 'react'
import { useFormStatus } from 'react-dom'
import { receberPensos } from '@/lib/accoes/financeiro'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { Campo, Entrada, Selector } from '@/components/ui/campos'
import { Aviso } from '@/components/ui/superficie'
import { ROTULOS_METODO } from '@/lib/rotulos'
import { formatarEuros, hoje } from '@/lib/formatos'
import type { MetodoPagamento } from '@/lib/tipos-bd'

export type ContaOpcao = { id: string; nome: string }

/**
 * Ordem dos métodos, a mais usada primeiro.
 *
 * Não é a ordem do enum: na cavalariça recebe-se por transferência, MB Way ou
 * dinheiro, e são esses três que têm de estar no primeiro toque. Os outros
 * ficam a seguir porque existem e têm de poder ser escolhidos.
 */
const ORDEM_METODOS: MetodoPagamento[] = [
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
 */
function EscolhaMetodo({ omissao }: { omissao: MetodoPagamento }) {
  // Os radios agrupam-se por nome dentro do mesmo <form>, e cada painel de
  // pagamento é um formulário — por isso podem partilhar o nome sem colidir.
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">Como foi pago</legend>
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

function CamposComuns({
  contas,
  contaOmissao,
  metodoOmissao,
}: {
  contas: ContaOpcao[]
  contaOmissao: string
  metodoOmissao: MetodoPagamento
}) {
  // Há mais do que um destes painéis na mesma página — um por mês em falta —,
  // por isso os `id` têm de ser únicos ou as etiquetas apontam todas ao primeiro.
  const prefixo = useId()

  return (
    <>
      <EscolhaMetodo omissao={metodoOmissao} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Data" htmlFor={`${prefixo}-data`}>
          <Entrada
            type="date"
            id={`${prefixo}-data`}
            name="data"
            defaultValue={hoje()}
          />
        </Campo>

        <Campo etiqueta="Entrou na conta" htmlFor={`${prefixo}-conta`}>
          <Selector
            id={`${prefixo}-conta`}
            name="conta_id"
            defaultValue={contaOmissao}
            required
          >
            {contas.map((conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.nome}
              </option>
            ))}
          </Selector>
        </Campo>
      </div>
    </>
  )
}

function BotaoRegistar({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus()
  return (
    <Botao type="submit" disabled={pending}>
      {pending ? 'A registar…' : rotulo}
    </Botao>
  )
}

/** Painel de recebimento de uma mensalidade, dentro da linha da conta-corrente. */
export function ReceberMensalidade({
  mensalidadeId,
  emFalta,
  contas,
  contaOmissao,
  metodoOmissao,
}: {
  mensalidadeId: string
  emFalta: number
  contas: ContaOpcao[]
  contaOmissao: string
  metodoOmissao: MetodoPagamento
}) {
  const [resultado, executar] = useActionState(receberPensos, SEM_RESULTADO)

  return (
    <details className="mt-2 rounded-md border border-border">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-primary">
        Registar pagamento
      </summary>

      <form action={executar} className="space-y-3 border-t border-border p-3">
        <input type="hidden" name="mensalidades" value={mensalidadeId} />

        <CamposComuns
          contas={contas}
          contaOmissao={contaOmissao}
          metodoOmissao={metodoOmissao}
        />

        <Campo
          etiqueta="Valor (€)"
          htmlFor={`valor-${mensalidadeId}`}
          ajuda="Já vem preenchido com o que falta. Altere para registar um pagamento parcial."
        >
          <Entrada
            id={`valor-${mensalidadeId}`}
            name="valor"
            inputMode="decimal"
            defaultValue={emFalta.toFixed(2).replace('.', ',')}
            required
            autoComplete="off"
          />
        </Campo>

        <BotaoRegistar rotulo="Registar pagamento" />

        {resultado.mensagem ? (
          <Aviso tom={resultado.ok ? 'sucesso' : 'erro'}>
            {resultado.mensagem}
          </Aviso>
        ) : null}
      </form>
    </details>
  )
}

/** Recebe de uma vez tudo o que o cliente tem em falta. */
export function ReceberTudo({
  mensalidadeIds,
  total,
  contas,
  contaOmissao,
  metodoOmissao,
}: {
  mensalidadeIds: string[]
  total: number
  contas: ContaOpcao[]
  contaOmissao: string
  metodoOmissao: MetodoPagamento
}) {
  const [resultado, executar] = useActionState(receberPensos, SEM_RESULTADO)

  return (
    <form action={executar} className="space-y-3">
      {mensalidadeIds.map((id) => (
        <input key={id} type="hidden" name="mensalidades" value={id} />
      ))}

      <CamposComuns
        contas={contas}
        contaOmissao={contaOmissao}
        metodoOmissao={metodoOmissao}
      />

      <BotaoRegistar
        rotulo={
          mensalidadeIds.length === 1
            ? `Receber ${formatarEuros(total)}`
            : `Receber os ${mensalidadeIds.length} meses — ${formatarEuros(total)}`
        }
      />

      {resultado.mensagem ? (
        <Aviso tom={resultado.ok ? 'sucesso' : 'erro'}>{resultado.mensagem}</Aviso>
      ) : null}
    </form>
  )
}
