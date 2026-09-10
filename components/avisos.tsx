'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { apagarAviso, guardarAviso } from '@/lib/accoes/eventos'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { AreaTexto } from '@/components/ui/campos'
import { Aviso as Caixa } from '@/components/ui/superficie'
import { formatarDataHora } from '@/lib/formatos'

export type AvisoPublicado = {
  id: string
  texto: string
  criado_em: string
  autor: { nome: string } | null
}

function Publicar() {
  const { pending } = useFormStatus()
  return (
    <Botao type="submit" variante="contorno" tamanho="pequeno" disabled={pending}>
      {pending ? 'A publicar…' : 'Publicar aviso'}
    </Botao>
  )
}

/**
 * Avisos de um evento ou de uma equipa: comunicação de um para muitos.
 *
 * Não é um chat de propósito. Um aviso fica agarrado ao evento, aparece no
 * quadro do dia a quem está convocado, e vai na descrição do evento no
 * calendário do telemóvel — que é onde as pessoas realmente olham.
 */
export function Avisos({
  avisos,
  eventoId,
  equipaId,
  voltar,
  podeEscrever,
}: {
  avisos: AvisoPublicado[]
  eventoId?: string
  equipaId?: string
  voltar: string
  podeEscrever: boolean
}) {
  const [resultado, executar] = useActionState(guardarAviso, SEM_RESULTADO)

  return (
    <div className="space-y-3">
      {avisos.length > 0 ? (
        <ul className="space-y-2">
          {avisos.map((aviso) => (
            <li
              key={aviso.id}
              className="rounded-md border-l-[3px] border-primary bg-primary/8 px-3 py-2"
            >
              <p className="whitespace-pre-wrap text-sm">{aviso.texto}</p>
              <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {aviso.autor?.nome ?? 'Quinta da Figueira'} ·{' '}
                  {formatarDataHora(aviso.criado_em)}
                </span>
                {podeEscrever ? (
                  <Apagar id={aviso.id} voltar={voltar} />
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sem avisos.
          {podeEscrever
            ? ' Escreva um para quem está convocado o ler aqui e no calendário.'
            : ''}
        </p>
      )}

      {podeEscrever ? (
        <form action={executar} className="space-y-2">
          {eventoId ? (
            <input type="hidden" name="evento_id" value={eventoId} />
          ) : null}
          {equipaId ? (
            <input type="hidden" name="equipa_id" value={equipaId} />
          ) : null}

          <AreaTexto
            name="texto"
            required
            rows={2}
            placeholder="Ex.: Trazer as camisolas azuis. Encontro 20 minutos antes."
            aria-label="Novo aviso"
          />

          <Publicar />

          {resultado.mensagem ? (
            <Caixa tom={resultado.ok ? 'sucesso' : 'erro'}>
              {resultado.mensagem}
            </Caixa>
          ) : null}
        </form>
      ) : null}
    </div>
  )
}

function Apagar({ id, voltar }: { id: string; voltar: string }) {
  const [, executar] = useActionState(apagarAviso, SEM_RESULTADO)
  return (
    <form action={executar} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="voltar" value={voltar} />
      <button
        type="submit"
        className="underline underline-offset-2 hover:text-destructive"
      >
        apagar
      </button>
    </form>
  )
}
