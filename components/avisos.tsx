'use client'

import { useActionState } from 'react'
import { useFormularioDeAccao } from '@/components/usar-formulario'
import { useFormStatus } from 'react-dom'
import { apagarAviso, guardarAviso } from '@/lib/accoes/eventos'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { AreaTexto } from '@/components/ui/campos'
import { Aviso as Caixa } from '@/components/ui/superficie'
import { formatarDataHora } from '@/lib/formatos'
import { Reaccoes } from '@/components/reaccoes'
import type { ReaccaoAgrupada } from '@/lib/reaccoes'

export type AvisoPublicado = {
  id: string
  texto: string
  criado_em: string
  autor: { nome: string } | null
  /** Só no chat — ver `Avisos`. */
  reaccoes?: ReaccaoAgrupada[]
}

function Publicar({ conversa }: { conversa: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Botao type="submit" variante="contorno" tamanho="pequeno" disabled={pending}>
      {pending
        ? conversa
          ? 'A enviar…'
          : 'A publicar…'
        : conversa
          ? 'Enviar'
          : 'Publicar aviso'}
    </Botao>
  )
}

/**
 * A mesma lista serve duas coisas que não são iguais.
 *
 * **Num evento é um aviso**: comunicação de um para muitos. Quem planeia
 * escreve, quem está convocado lê — no quadro do dia e na descrição do evento
 * no calendário do telemóvel, que é onde as pessoas realmente olham.
 *
 * **Numa equipa é uma conversa**, e isso foi pedido. O grupo existe para
 * falar entre si, por isso qualquer membro escreve. O que **não** muda é quem
 * apaga: ninguém reescreve o que já foi dito, nem o próprio autor — é a regra
 * de `notas_cavalo`, e aqui vale pelo mesmo motivo.
 *
 * Vale a pena ser claro sobre o que isto não é: **não há tempo real.** As
 * mensagens aparecem quando a página é carregada. O que as faz chegar a tempo
 * é a notificação que `guardarAviso` manda aos membros — sem ela isto ficava
 * deserto, que foi o motivo de durante muito tempo não existir de todo.
 *
 * **As reacções são só do chat**, e isso é uma escolha e não um esquecimento:
 * a RLS deixa reagir a qualquer mensagem que se possa ler, mas num aviso de
 * evento uma fila de emojis por baixo não acrescenta nada a quem vai ler o
 * quadro do dia. Passar a oferecê-las lá é dar `meuNome` também nesse ecrã.
 */
export function Avisos({
  avisos,
  eventoId,
  equipaId,
  voltar,
  podeEscrever,
  podeApagar,
  modo = 'avisos',
  meuNome,
}: {
  avisos: AvisoPublicado[]
  eventoId?: string
  equipaId?: string
  voltar: string
  podeEscrever: boolean
  /** Quem apaga não é quem escreve — ver em cima. Omitido, segue `podeEscrever`. */
  podeApagar?: boolean
  modo?: 'avisos' | 'conversa'
  /** Dado, as mensagens ganham reacções. É o nome de quem está a ver. */
  meuNome?: string
}) {
  const conversa = modo === 'conversa'
  const reage = conversa && Boolean(meuNome)
  const apaga = podeApagar ?? podeEscrever
  const { resultado, executar, formulario } = useFormularioDeAccao(guardarAviso)

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
                {apaga ? <Apagar id={aviso.id} voltar={voltar} /> : null}
              </p>
              {reage ? (
                <Reaccoes
                  avisoId={aviso.id}
                  reaccoes={aviso.reaccoes ?? []}
                  meuNome={meuNome as string}
                  caminho={voltar}
                  podeReagir
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {conversa ? 'Ainda ninguém escreveu nada.' : 'Sem avisos.'}
          {podeEscrever
            ? conversa
              ? ' Quem está na equipa recebe um aviso no telemóvel.'
              : ' Escreva um para quem está convocado o ler aqui e no calendário.'
            : ''}
        </p>
      )}

      {podeEscrever ? (
        <form ref={formulario} action={executar} className="space-y-2">
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
            placeholder={
              conversa
                ? 'Escreva para a equipa…'
                : 'Ex.: Trazer as camisolas azuis. Encontro 20 minutos antes.'
            }
            aria-label={conversa ? 'Nova mensagem' : 'Novo aviso'}
          />

          <Publicar conversa={conversa} />

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
