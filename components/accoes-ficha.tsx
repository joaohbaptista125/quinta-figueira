'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Trash2 } from 'lucide-react'
import { SEM_RESULTADO, type ResultadoAccao } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { Aviso } from '@/components/ui/superficie'

type Accao = (anterior: ResultadoAccao, dados: FormData) => Promise<ResultadoAccao>

/**
 * As duas saídas de uma ficha, no cabeçalho: tirar da circulação, ou apagar.
 *
 * Antes isto era um só botão «Apagar» no fundo do formulário, por baixo de
 * vinte campos. Como quase tudo o que existe há algum tempo tem coisas
 * agarradas, a resposta era quase sempre uma recusa a mandar «marque como
 * inactivo» — e isso era uma caixa de visto escondida no meio dos mesmos
 * vinte campos, que era preciso ir encontrar e depois gravar.
 *
 * O desenho é o mesmo nas três fichas que o usam (pessoa, cavalo, contrato);
 * o que muda é o nome da primeira saída: uma pessoa e um cavalo
 * desactivam-se, um contrato termina-se. A recusa de apagar vem do servidor e
 * diz o que prende o registo, contado.
 */
export function AccoesFicha({
  id,
  alternar,
  apagar,
}: {
  id: string
  /** A saída branda. Omitir quando não há nenhuma (ou não é permitida). */
  alternar?: {
    accao: Accao
    rotulo: string
    /** O que vai acontecer, para o `title` do botão. */
    titulo?: string
    Icone: React.ComponentType<{ className?: string }>
  }
  apagar: {
    accao: Accao
    /** O que se pergunta antes. Diz sempre o que se perde. */
    confirmacao: string
  }
}) {
  const [resultadoAlternar, executarAlternar] = useActionState(
    alternar?.accao ?? naoFazNada,
    SEM_RESULTADO,
  )
  const [resultadoApagar, executarApagar] = useActionState(
    apagar.accao,
    SEM_RESULTADO,
  )

  return (
    <div className="w-full space-y-2 sm:w-auto sm:max-w-md">
      <div className="flex flex-wrap gap-2">
        {alternar ? (
          <form action={executarAlternar}>
            <input type="hidden" name="id" value={id} />
            <BotaoAlternar
              rotulo={alternar.rotulo}
              titulo={alternar.titulo}
              Icone={alternar.Icone}
            />
          </form>
        ) : null}

        <form action={executarApagar}>
          <input type="hidden" name="id" value={id} />
          <BotaoApagar confirmacao={apagar.confirmacao} />
        </form>
      </div>

      {resultadoAlternar.mensagem ? (
        <Aviso tom={resultadoAlternar.ok ? 'sucesso' : 'erro'}>
          {resultadoAlternar.mensagem}
        </Aviso>
      ) : null}

      {/* A recusa de apagar é informação, não avaria: diz o que fazer. */}
      {resultadoApagar.mensagem ? (
        <Aviso tom="atencao">{resultadoApagar.mensagem}</Aviso>
      ) : null}
    </div>
  )
}

/** `useActionState` precisa sempre de uma acção, mesmo sem botão que a chame. */
async function naoFazNada(): Promise<ResultadoAccao> {
  return SEM_RESULTADO
}

function BotaoAlternar({
  rotulo,
  titulo,
  Icone,
}: {
  rotulo: string
  titulo?: string
  Icone: React.ComponentType<{ className?: string }>
}) {
  const { pending } = useFormStatus()
  return (
    <Botao type="submit" variante="contorno" disabled={pending} title={titulo}>
      <Icone className="size-4" />
      {pending ? 'Um instante…' : rotulo}
    </Botao>
  )
}

function BotaoApagar({ confirmacao }: { confirmacao: string }) {
  const { pending } = useFormStatus()
  return (
    <Botao
      type="submit"
      variante="destrutivo"
      disabled={pending}
      onClick={(evento) => {
        if (!window.confirm(confirmacao)) evento.preventDefault()
      }}
    >
      <Trash2 className="size-4" aria-hidden />
      {pending ? 'A apagar…' : 'Apagar'}
    </Botao>
  )
}
