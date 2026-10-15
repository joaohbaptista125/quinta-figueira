'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Trash2, UserCheck, UserMinus } from 'lucide-react'
import { alternarActivoPessoa, apagarPessoa } from '@/lib/accoes/pessoas'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { Aviso } from '@/components/ui/superficie'

/**
 * Tirar uma pessoa da frente, no topo da ficha.
 *
 * Antes isto estava no fundo do formulário, por baixo de vinte campos, e era
 * um só botão: «Apagar». Como quase toda a gente tem cavalos, contratos ou
 * pagamentos, a resposta era quase sempre uma recusa a dizer «marque como
 * inactiva» — e marcar como inactiva era uma caixa de visto escondida a meio
 * do mesmo formulário, que era preciso ir encontrar e depois gravar.
 *
 * Agora as duas saídas estão lado a lado, à vista, e a recusa de apagar diz
 * exactamente o que prende a ficha.
 */
export function AccoesPessoa({
  id,
  nome,
  activa,
  eEuPropria,
}: {
  id: string
  nome: string
  activa: boolean
  /** A própria sessão: desactivar-se a si mesmo tranca a pessoa cá fora. */
  eEuPropria: boolean
}) {
  const [resultadoActivo, alternar] = useActionState(
    alternarActivoPessoa,
    SEM_RESULTADO,
  )
  const [resultadoApagar, apagar] = useActionState(apagarPessoa, SEM_RESULTADO)

  const primeiroNome = nome.split(' ')[0]

  return (
    <div className="w-full space-y-2 sm:w-auto sm:max-w-md">
      <div className="flex flex-wrap gap-2">
        {!eEuPropria ? (
          <form action={alternar}>
            <input type="hidden" name="id" value={id} />
            <BotaoAlternar activa={activa} nome={primeiroNome} />
          </form>
        ) : null}

        <form action={apagar}>
          <input type="hidden" name="id" value={id} />
          <BotaoApagarFicha nome={nome} />
        </form>
      </div>

      {resultadoActivo.mensagem ? (
        <Aviso tom={resultadoActivo.ok ? 'sucesso' : 'erro'}>
          {resultadoActivo.mensagem}
        </Aviso>
      ) : null}

      {resultadoApagar.mensagem ? (
        <Aviso tom="atencao">{resultadoApagar.mensagem}</Aviso>
      ) : null}
    </div>
  )
}

function BotaoAlternar({ activa, nome }: { activa: boolean; nome: string }) {
  const { pending } = useFormStatus()

  return (
    <Botao
      type="submit"
      variante="contorno"
      disabled={pending}
      title={
        activa
          ? `${nome} sai das listas e dos formulários, e tudo o que já lá está fica`
          : `${nome} volta a aparecer nas listas`
      }
    >
      {activa ? (
        <UserMinus className="size-4" aria-hidden />
      ) : (
        <UserCheck className="size-4" aria-hidden />
      )}
      {pending ? 'Um instante…' : activa ? 'Desactivar' : 'Reactivar'}
    </Botao>
  )
}

function BotaoApagarFicha({ nome }: { nome: string }) {
  const { pending } = useFormStatus()

  return (
    <Botao
      type="submit"
      variante="destrutivo"
      disabled={pending}
      onClick={(evento) => {
        // Apagar é para fichas que nunca chegaram a ter vida — um engano de
        // digitação. Para o resto a base recusa, e a recusa explica.
        const certeza = window.confirm(
          `Apagar a ficha de ${nome} para sempre?\n\nSe tiver cavalos, contratos ou pagamentos, a aplicação recusa — nesse caso use «Desactivar».`,
        )
        if (!certeza) evento.preventDefault()
      }}
    >
      <Trash2 className="size-4" aria-hidden />
      {pending ? 'A apagar…' : 'Apagar'}
    </Botao>
  )
}
