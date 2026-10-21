'use client'

import { useActionState, useId } from 'react'
import { useFormStatus } from 'react-dom'
import { receberEncargo, receberPensos } from '@/lib/accoes/financeiro'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { Campo, Entrada, Selector } from '@/components/ui/campos'
import { Aviso } from '@/components/ui/superficie'
import { EscolhaMetodo } from '@/components/escolha-metodo'
import { formatarEuros, hoje } from '@/lib/formatos'
import type { MetodoPagamento } from '@/lib/tipos-bd'

export type ContaOpcao = { id: string; nome: string }

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

/**
 * Recebe um encargo avulso — a ferração que o centro adiantou, e o resto.
 *
 * É o mesmo painel das mensalidades, com a mesma mecânica: método em
 * pastilhas, data, conta, confirmar. Separado porque o que se paga é outra
 * coisa — um encargo não tem período nem contrato, e a acção que o recebe é
 * outra.
 */
export function ReceberEncargo({
  encargoId,
  emFalta,
  contas,
  contaOmissao,
  metodoOmissao,
}: {
  encargoId: string
  emFalta: number
  contas: ContaOpcao[]
  contaOmissao: string
  metodoOmissao: MetodoPagamento
}) {
  const [resultado, executar] = useActionState(receberEncargo, SEM_RESULTADO)

  return (
    <details className="mt-2 rounded-md border border-border">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-primary">
        Registar pagamento
      </summary>

      <form action={executar} className="space-y-3 border-t border-border p-3">
        <input type="hidden" name="encargo" value={encargoId} />

        <CamposComuns
          contas={contas}
          contaOmissao={contaOmissao}
          metodoOmissao={metodoOmissao}
        />

        <Campo
          etiqueta="Valor (€)"
          htmlFor={`valor-encargo-${encargoId}`}
          ajuda="Já vem preenchido com o que falta. Altere para registar um pagamento parcial."
        >
          <Entrada
            id={`valor-encargo-${encargoId}`}
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
