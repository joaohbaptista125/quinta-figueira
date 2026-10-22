'use client'

import { useActionState, useId } from 'react'
import { useFormularioDeAccao } from '@/components/usar-formulario'
import { useFormStatus } from 'react-dom'
import { MessageSquare, Trash2 } from 'lucide-react'
import { apagarNota, escreverNota } from '@/lib/accoes/notas'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { AreaTexto } from '@/components/ui/campos'
import {
  Aviso,
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  Distintivo,
  SemRegistos,
  TituloCartao,
} from '@/components/ui/superficie'
import { formatarDataHora } from '@/lib/formatos'

export type Nota = {
  id: string
  texto: string
  criado_em: string
  de_equipa: boolean
  pessoas: { nome: string } | null
}

/**
 * A conversa de um cavalo, na ficha dele.
 *
 * Não é um chat, é o caderno do cavalo: o dono pergunta, a cavalariça
 * responde, e daqui a um ano lê-se o que se passou. É também por aqui que o
 * cliente pede uma correcção aos dados — ele escreve, a gestão corrige à mão,
 * que é o que faria de qualquer maneira para confirmar antes de gravar.
 *
 * Mais antiga em cima: lê-se como uma conversa, não como uma caixa de correio.
 */
export function NotasCavalo({
  cavaloId,
  notas,
  podeEscrever,
  podeApagar,
  souDaEquipa,
}: {
  cavaloId: string
  notas: Nota[]
  podeEscrever: boolean
  podeApagar: boolean
  /** Muda o texto de quem escreve: a equipa responde, o dono pergunta. */
  souDaEquipa: boolean
}) {
  const porResponder = notas.length > 0 && !notas[notas.length - 1].de_equipa

  return (
    <Cartao>
      <CabecalhoCartao>
        <TituloCartao className="flex items-center gap-2">
          <MessageSquare className="size-4 text-muted-foreground" aria-hidden />
          Notas e pedidos
          {porResponder && souDaEquipa ? (
            <Distintivo cor="aviso">Por responder</Distintivo>
          ) : null}
        </TituloCartao>
        <DescricaoCartao>
          {souDaEquipa
            ? 'O que o proprietário pergunta sobre este cavalo, e o que lhe respondemos.'
            : 'Pergunte aqui o que precisar sobre este cavalo. A equipa do centro responde-lhe neste mesmo sítio.'}
        </DescricaoCartao>
      </CabecalhoCartao>

      <ConteudoCartao className="space-y-3">
        {notas.length > 0 ? (
          <ol className="space-y-2">
            {notas.map((nota) => (
              <li
                key={nota.id}
                className={
                  nota.de_equipa
                    ? 'rounded-md border border-border bg-muted/40 px-3 py-2'
                    : 'rounded-md border border-border px-3 py-2'
                }
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {nota.pessoas?.nome ?? 'Alguém'}
                  </span>
                  {nota.de_equipa ? <Distintivo>Centro</Distintivo> : null}
                  <span className="tabular">{formatarDataHora(nota.criado_em)}</span>
                  {podeApagar ? (
                    <BotaoApagarNota id={nota.id} cavaloId={cavaloId} />
                  ) : null}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{nota.texto}</p>
              </li>
            ))}
          </ol>
        ) : (
          <SemRegistos
            titulo="Ainda não há nada escrito"
            descricao={
              souDaEquipa
                ? 'Quando o proprietário escrever sobre este cavalo, aparece aqui.'
                : 'Escreva o que precisar: uma dúvida, uma mudança que notou, ou um dado da ficha que esteja errado.'
            }
          />
        )}

        {podeEscrever ? (
          <FormularioNota cavaloId={cavaloId} souDaEquipa={souDaEquipa} />
        ) : null}
      </ConteudoCartao>
    </Cartao>
  )
}

function BotaoEscrever({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus()
  return (
    <Botao type="submit" disabled={pending}>
      {pending ? 'A enviar…' : rotulo}
    </Botao>
  )
}

function FormularioNota({
  cavaloId,
  souDaEquipa,
}: {
  cavaloId: string
  souDaEquipa: boolean
}) {
  const { resultado, executar, formulario } = useFormularioDeAccao(escreverNota)
  const id = useId()

  return (
    <form
      ref={formulario}
      action={executar}
      className="space-y-2 border-t border-border pt-3"
    >
      <input type="hidden" name="cavalo_id" value={cavaloId} />

      <label htmlFor={id} className="sr-only">
        {souDaEquipa ? 'Responder' : 'Escrever'}
      </label>
      <AreaTexto
        id={id}
        name="texto"
        rows={3}
        maxLength={2000}
        required
        placeholder={
          souDaEquipa
            ? 'Responder ao proprietário…'
            : 'Uma dúvida, algo que notou, um dado errado na ficha…'
        }
      />

      <BotaoEscrever rotulo={souDaEquipa ? 'Responder' : 'Enviar'} />

      {resultado.mensagem && !resultado.ok ? (
        <Aviso tom="erro">{resultado.mensagem}</Aviso>
      ) : null}
    </form>
  )
}

function BotaoApagarNota({ id, cavaloId }: { id: string; cavaloId: string }) {
  const [, executar] = useActionState(apagarNota, SEM_RESULTADO)

  return (
    <form action={executar} className="ml-auto">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="cavalo_id" value={cavaloId} />
      <button
        type="submit"
        title="Apagar esta nota"
        className="text-muted-foreground transition-colors hover:text-destructive"
        onClick={(evento) => {
          if (!window.confirm('Apagar esta nota? Não há como a repor.')) {
            evento.preventDefault()
          }
        }}
      >
        <Trash2 className="size-3.5" />
        <span className="sr-only">Apagar</span>
      </button>
    </form>
  )
}
