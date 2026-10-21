'use client'

import { useActionState, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Check, X } from 'lucide-react'
import {
  confirmarDeclaracao,
  recusarDeclaracao,
} from '@/lib/accoes/declaracoes'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { Campo, Entrada, Selector } from '@/components/ui/campos'
import { Aviso } from '@/components/ui/superficie'
import { EscolhaMetodo } from '@/components/escolha-metodo'
import type { MetodoPagamento } from '@/lib/tipos-bd'
import type { ContaOpcao } from '@/components/pagamento-penso'

/**
 * Confirmar — ou recusar — um pagamento que o cliente diz ter feito.
 *
 * Três coisas que este painel tem de deixar claras, e que são a razão de ele
 * existir em vez de um botão «aceitar»:
 *
 * 1. **O que fica registado é o que a gestão confirmar**, não o que o cliente
 *    escreveu. O valor, a data e o método abrem já preenchidos com o que ele
 *    disse, e são editáveis — quem recebe é que sabe o que entrou.
 * 2. **A conta escolhe-se aqui, sempre.** O cliente não sabe (nem deve saber)
 *    para que conta do centro o dinheiro entrou, por isso nunca a declara.
 * 3. **Recusar exige motivo.** É a única coisa que a pessoa vai ler, e «foi
 *    recusado» sem mais nada é pior do que silêncio.
 */
export function ConfirmarPagamento({
  declaracaoId,
  valor,
  data,
  metodo,
  contas,
  contaOmissao,
}: {
  declaracaoId: string
  valor: number
  data: string
  metodo: MetodoPagamento
  contas: ContaOpcao[]
  contaOmissao: string
}) {
  const [aRecusar, setARecusar] = useState(false)

  if (aRecusar) {
    return <Recusar declaracaoId={declaracaoId} aoDesistir={() => setARecusar(false)} />
  }

  return (
    <Confirmar
      declaracaoId={declaracaoId}
      valor={valor}
      data={data}
      metodo={metodo}
      contas={contas}
      contaOmissao={contaOmissao}
      aoRecusar={() => setARecusar(true)}
    />
  )
}

function Confirmar({
  declaracaoId,
  valor,
  data,
  metodo,
  contas,
  contaOmissao,
  aoRecusar,
}: {
  declaracaoId: string
  valor: number
  data: string
  metodo: MetodoPagamento
  contas: ContaOpcao[]
  contaOmissao: string
  aoRecusar: () => void
}) {
  const [resultado, confirmar] = useActionState(confirmarDeclaracao, SEM_RESULTADO)
  const prefixo = useId()

  return (
    <form action={confirmar} className="space-y-3">
      <input type="hidden" name="id" value={declaracaoId} />

      <EscolhaMetodo omissao={metodo} legenda="Como entrou" />

      <div
        className={
          contas.length > 1
            ? 'grid gap-3 sm:grid-cols-3'
            : 'grid gap-3 sm:grid-cols-2'
        }
      >
        <Campo etiqueta="Valor" htmlFor={`${prefixo}-valor`}>
          <Entrada
            id={`${prefixo}-valor`}
            name="valor"
            inputMode="decimal"
            defaultValue={valor.toFixed(2).replace('.', ',')}
          />
        </Campo>

        <Campo etiqueta="Data" htmlFor={`${prefixo}-data`}>
          <Entrada
            id={`${prefixo}-data`}
            name="data"
            type="date"
            defaultValue={data.slice(0, 10)}
          />
        </Campo>

        {/* Com uma conta só, ou nenhuma, não há escolha nenhuma a fazer: o
            dinheiro entra na caixa do centro, e a acção trata disso. */}
        {contas.length > 1 ? (
          <Campo etiqueta="Entrou em" htmlFor={`${prefixo}-conta`}>
            <Selector
              id={`${prefixo}-conta`}
              name="conta_id"
              defaultValue={contaOmissao}
            >
              {contas.map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.nome}
                </option>
              ))}
            </Selector>
          </Campo>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <BotaoConfirmar />
        <Botao variante="contorno" onClick={aoRecusar}>
          <X className="size-4" aria-hidden />
          Não entrou
        </Botao>
      </div>

      {resultado.mensagem ? (
        <Aviso tom={resultado.ok ? 'sucesso' : 'erro'}>{resultado.mensagem}</Aviso>
      ) : null}
    </form>
  )
}

function BotaoConfirmar() {
  const { pending } = useFormStatus()
  return (
    <Botao type="submit" disabled={pending}>
      <Check className="size-4" aria-hidden />
      {pending ? 'A registar…' : 'Confirmar e registar'}
    </Botao>
  )
}

function Recusar({
  declaracaoId,
  aoDesistir,
}: {
  declaracaoId: string
  aoDesistir: () => void
}) {
  const [resultado, recusar] = useActionState(recusarDeclaracao, SEM_RESULTADO)
  const prefixo = useId()

  return (
    <form action={recusar} className="space-y-3">
      <input type="hidden" name="id" value={declaracaoId} />

      <Campo
        etiqueta="Porquê"
        htmlFor={`${prefixo}-motivo`}
        ajuda="Vai inteiro para a notificação da pessoa, por isso escreva-o para ela."
        obrigatorio
      >
        <Entrada
          id={`${prefixo}-motivo`}
          name="motivo"
          required
          autoFocus
          autoComplete="off"
          placeholder="Ex.: até hoje não entrou nada na conta."
        />
      </Campo>

      <div className="flex flex-wrap gap-2">
        <BotaoRecusar />
        <Botao variante="fantasma" onClick={aoDesistir}>
          Voltar atrás
        </Botao>
      </div>

      {resultado.mensagem ? (
        <Aviso tom={resultado.ok ? 'sucesso' : 'erro'}>{resultado.mensagem}</Aviso>
      ) : null}
    </form>
  )
}

function BotaoRecusar() {
  const { pending } = useFormStatus()
  return (
    <Botao type="submit" variante="destrutivo" disabled={pending}>
      {pending ? 'A recusar…' : 'Recusar e avisar'}
    </Botao>
  )
}
