'use client'

import { useActionState, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Clock, Info, Undo2 } from 'lucide-react'
import {
  declararPagamento,
  retirarDeclaracao,
} from '@/lib/accoes/declaracoes'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { Campo, Entrada } from '@/components/ui/campos'
import { Aviso } from '@/components/ui/superficie'
import { EscolhaMetodo } from '@/components/escolha-metodo'
import { ROTULOS_METODO } from '@/lib/rotulos'
import { formatarData, formatarEuros, hoje } from '@/lib/formatos'
import type { MetodoPagamento } from '@/lib/tipos-bd'

/** O que a página já sabe sobre a última declaração deste item. */
export type DeclaracaoDoItem = {
  id: string
  valor: number
  data: string
  metodo_pagamento: MetodoPagamento
  referencia: string | null
  estado: 'pendente' | 'confirmada' | 'recusada'
  motivo: string | null
}

/**
 * «Já paguei», do lado de quem paga.
 *
 * Isto **não** regista um pagamento: avisa o centro de que foi feito um, e
 * fica à espera de confirmação. A diferença não é burocracia — é o que impede
 * que carregar num botão se transforme em dar-se por pago. Por isso o texto do
 * botão é «Já paguei» e não «Pagar», e o estado seguinte diz «a aguardar
 * confirmação» em vez de «pago».
 *
 * O formulário só abre ao toque: numa página com oito meses em falta, oito
 * formulários abertos não se lêem.
 */
export function DeclararPagamento({
  mensalidadeId,
  encargoId,
  emFalta,
  declaracao,
  metodoOmissao = 'transferencia',
}: {
  mensalidadeId?: string
  encargoId?: string
  emFalta: number
  declaracao?: DeclaracaoDoItem
  metodoOmissao?: MetodoPagamento
}) {
  if (declaracao?.estado === 'pendente') {
    return <PorConfirmar declaracao={declaracao} />
  }

  return (
    <div className="mt-2 space-y-2">
      {declaracao?.estado === 'recusada' ? (
        <Aviso tom="atencao">
          <strong>O centro não confirmou este pagamento.</strong>{' '}
          {declaracao.motivo ?? 'Fale com a gestão.'} Se se enganou nos dados,
          pode avisar outra vez em baixo.
        </Aviso>
      ) : null}

      <Formulario
        mensalidadeId={mensalidadeId}
        encargoId={encargoId}
        emFalta={emFalta}
        metodoOmissao={metodoOmissao}
      />
    </div>
  )
}

/** O que se vê depois de avisar: nem pago, nem por avisar. */
function PorConfirmar({ declaracao }: { declaracao: DeclaracaoDoItem }) {
  const [resultado, retirar] = useActionState(retirarDeclaracao, SEM_RESULTADO)

  return (
    <div className="mt-2 rounded-md border border-dashed border-input bg-muted/40 px-3 py-2">
      <p className="flex flex-wrap items-center gap-1.5 text-sm">
        <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="font-medium">A aguardar confirmação</span>
        <span className="text-muted-foreground">
          · {formatarEuros(declaracao.valor)} por{' '}
          {ROTULOS_METODO[declaracao.metodo_pagamento].toLowerCase()} a{' '}
          {formatarData(declaracao.data)}
        </span>
      </p>
      {declaracao.referencia ? (
        <p className="mt-0.5 text-xs text-muted-foreground">
          Referência: {declaracao.referencia}
        </p>
      ) : null}

      <form action={retirar} className="mt-1.5">
        <input type="hidden" name="id" value={declaracao.id} />
        <BotaoRetirar />
      </form>

      {resultado.mensagem && !resultado.ok ? (
        <Aviso tom="erro" className="mt-2">
          {resultado.mensagem}
        </Aviso>
      ) : null}
    </div>
  )
}

function BotaoRetirar() {
  const { pending } = useFormStatus()
  return (
    <Botao type="submit" variante="fantasma" tamanho="pequeno" disabled={pending}>
      <Undo2 className="size-3.5" aria-hidden />
      {pending ? 'A retirar…' : 'Afinal não, retirar o aviso'}
    </Botao>
  )
}

function Formulario({
  mensalidadeId,
  encargoId,
  emFalta,
  metodoOmissao,
}: {
  mensalidadeId?: string
  encargoId?: string
  emFalta: number
  metodoOmissao: MetodoPagamento
}) {
  const [aberto, setAberto] = useState(false)
  const [resultado, declarar] = useActionState(declararPagamento, SEM_RESULTADO)
  // Há um destes por cada mês em falta na mesma página: os `id` têm de ser
  // únicos ou as etiquetas apontam todas ao primeiro.
  const prefixo = useId()

  if (!aberto) {
    return (
      <>
        <Botao variante="contorno" tamanho="pequeno" onClick={() => setAberto(true)}>
          Já paguei
        </Botao>
        {resultado.mensagem ? (
          <Aviso tom={resultado.ok ? 'sucesso' : 'erro'} className="mt-2">
            {resultado.mensagem}
          </Aviso>
        ) : null}
      </>
    )
  }

  return (
    <form action={declarar} className="space-y-3 rounded-md border border-input p-3">
      {mensalidadeId ? (
        <input type="hidden" name="mensalidade_id" value={mensalidadeId} />
      ) : null}
      {encargoId ? <input type="hidden" name="encargo_id" value={encargoId} /> : null}

      <EscolhaMetodo omissao={metodoOmissao} legenda="Como pagou" />

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Quanto" htmlFor={`${prefixo}-valor`}>
          <Entrada
            id={`${prefixo}-valor`}
            name="valor"
            inputMode="decimal"
            defaultValue={emFalta.toFixed(2).replace('.', ',')}
            required
          />
        </Campo>

        <Campo etiqueta="Quando" htmlFor={`${prefixo}-data`}>
          <Entrada
            id={`${prefixo}-data`}
            name="data"
            type="date"
            max={hoje()}
            defaultValue={hoje()}
            required
          />
        </Campo>
      </div>

      <Campo
        etiqueta="Referência"
        htmlFor={`${prefixo}-ref`}
        ajuda="Opcional, mas ajuda a gestão a encontrar o movimento: os últimos dígitos do número de MB WAY, a referência da transferência, ou a quem entregou o dinheiro."
      >
        <Entrada
          id={`${prefixo}-ref`}
          name="referencia"
          autoComplete="off"
          placeholder="Ex.: MB WAY 91X XXX 678"
        />
      </Campo>

      <p className="flex gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        Isto avisa o centro. O pagamento só fica registado depois de a gestão o
        confirmar — e esta aplicação não emite factura nem recibo.
      </p>

      <div className="flex flex-wrap gap-2">
        <BotaoAvisar />
        <Botao variante="fantasma" onClick={() => setAberto(false)}>
          Cancelar
        </Botao>
      </div>

      {resultado.mensagem ? (
        <Aviso tom={resultado.ok ? 'sucesso' : 'erro'}>{resultado.mensagem}</Aviso>
      ) : null}
    </form>
  )
}

function BotaoAvisar() {
  const { pending } = useFormStatus()
  return (
    <Botao type="submit" disabled={pending}>
      {pending ? 'A avisar…' : 'Avisar o centro'}
    </Botao>
  )
}
