'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Mail } from 'lucide-react'
import { convidarPessoa } from '@/lib/accoes/pessoas'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { Aviso, Distintivo } from '@/components/ui/superficie'
import { formatarDataHora } from '@/lib/formatos'

/**
 * Estado de acesso de uma pessoa, e o botão que lhe abre a porta.
 *
 * Não há registo público nesta aplicação: ninguém se inscreve sozinho. A
 * gestão escreve a ficha, escolhe o perfil e envia o convite; a conta só nasce
 * quando a pessoa carrega no link que recebe por email.
 */
export function ConviteAcesso({
  id,
  nome,
  email,
  perfil,
  convidadoEm,
  acessoConfirmadoEm,
}: {
  id: string
  nome: string
  email: string | null
  /** Rótulo do perfil, ou null se a ficha não tem nenhum. */
  perfil: string | null
  convidadoEm: string | null
  /**
   * Primeira vez que entrou. É este o sinal de que tem mesmo conta — a linha
   * em `auth.users` nasce com o envio do convite, não com a entrada.
   */
  acessoConfirmadoEm: string | null
}) {
  const [resultado, convidar] = useActionState(convidarPessoa, SEM_RESULTADO)

  if (acessoConfirmadoEm) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Distintivo cor="sucesso">Entra na aplicação</Distintivo>
          <span className="text-sm text-muted-foreground">
            Desde {formatarDataHora(acessoConfirmadoEm)}, como{' '}
            {perfil ?? 'cliente'}.
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Se perdeu a palavra-passe, usa «Esqueci-me da palavra-passe» no ecrã
          de entrada — não é preciso fazer nada daqui.
        </p>
      </div>
    )
  }

  return (
    <form action={convidar} className="space-y-3">
      <input type="hidden" name="id" value={id} />

      <div className="flex flex-wrap items-center gap-2">
        {convidadoEm ? (
          <>
            <Distintivo cor="aviso">Convite enviado</Distintivo>
            <span className="text-sm text-muted-foreground">
              {formatarDataHora(convidadoEm)} · ainda não entrou
            </span>
          </>
        ) : (
          <Distintivo>Sem acesso</Distintivo>
        )}
      </div>

      {email ? (
        <p className="text-sm text-muted-foreground">
          O convite vai para <strong className="text-foreground">{email}</strong>
          {perfil ? (
            <>
              {' '}e {nome.split(' ')[0]} entra como{' '}
              <strong className="text-foreground">{perfil}</strong>.
            </>
          ) : (
            <>. Sem perfil escolhido, entra como cliente.</>
          )}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Esta ficha não tem email, e é para lá que o convite vai. Preencha-o
          primeiro.
        </p>
      )}

      <BotaoConvidar
        rotulo={convidadoEm ? 'Reenviar convite' : 'Enviar convite'}
        desactivado={!email}
      />

      {resultado.mensagem ? (
        <Aviso tom={resultado.ok ? 'sucesso' : 'erro'}>{resultado.mensagem}</Aviso>
      ) : null}
    </form>
  )
}

function BotaoConvidar({
  rotulo,
  desactivado,
}: {
  rotulo: string
  desactivado: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <Botao
      type="submit"
      variante="contorno"
      disabled={pending || desactivado}
      title={desactivado ? 'Preencha o email da ficha' : undefined}
    >
      <Mail className="size-4" aria-hidden />
      {pending ? 'A enviar…' : rotulo}
    </Botao>
  )
}
