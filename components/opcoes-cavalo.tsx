'use client'

import { useActionState, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Plus, RotateCcw, X } from 'lucide-react'
import {
  alternarOpcaoCavalo,
  criarOpcaoCavalo,
  renomearOpcaoCavalo,
} from '@/lib/accoes/cavalos'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { Entrada } from '@/components/ui/campos'
import { Aviso } from '@/components/ui/superficie'
import { ROTULOS_TIPO_OPCAO } from '@/lib/opcoes-cavalo'
import type { TipoOpcaoCavalo } from '@/lib/tipos-bd'

export type Opcao = {
  id: string
  valor: string
  activa: boolean
  /** Quantos cavalos usam este valor. */
  usos: number
}

function BotaoSubmeter({
  children,
  variante = 'contorno',
  ...resto
}: {
  children: React.ReactNode
  variante?: 'contorno' | 'fantasma' | 'primario'
  'aria-label'?: string
  title?: string
}) {
  const { pending } = useFormStatus()
  return (
    <Botao type="submit" variante={variante} tamanho="pequeno" disabled={pending} {...resto}>
      {children}
    </Botao>
  )
}

/**
 * Uma linha da lista: muda o nome, ou tira-a de circulação.
 *
 * O botão de gravar só aparece depois de o texto mudar — com catorze linhas
 * na página, catorze botões «Guardar» sempre visíveis eram ruído.
 */
export function LinhaOpcao({ opcao }: { opcao: Opcao }) {
  const [resultado, renomear] = useActionState(renomearOpcaoCavalo, SEM_RESULTADO)
  const [alternarResultado, alternar] = useActionState(
    alternarOpcaoCavalo,
    SEM_RESULTADO,
  )
  const [valor, setValor] = useState(opcao.valor)
  const campo = useId()
  const mudou = valor.trim() !== opcao.valor

  const erro = [resultado, alternarResultado].find((r) => r.mensagem && !r.ok)

  return (
    <li className="px-4 py-2.5 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <form action={renomear} className="flex min-w-0 flex-1 items-center gap-2">
          <input type="hidden" name="id" value={opcao.id} />
          <Entrada
            id={campo}
            name="valor"
            value={valor}
            onChange={(evento) => setValor(evento.target.value)}
            aria-label={`Nome de ${opcao.valor}`}
            className={opcao.activa ? '' : 'text-muted-foreground line-through'}
            autoComplete="off"
          />
          {mudou ? <BotaoSubmeter variante="primario">Guardar</BotaoSubmeter> : null}
        </form>

        <span className="shrink-0 text-xs text-muted-foreground">
          {opcao.usos === 0
            ? 'sem cavalos'
            : opcao.usos === 1
              ? '1 cavalo'
              : `${opcao.usos} cavalos`}
        </span>

        <form action={alternar} className="shrink-0">
          <input type="hidden" name="id" value={opcao.id} />
          <input type="hidden" name="activa" value={opcao.activa ? 'false' : 'true'} />
          <BotaoSubmeter
            variante="fantasma"
            aria-label={
              opcao.activa
                ? `Tirar ${opcao.valor} da lista`
                : `Repor ${opcao.valor} na lista`
            }
            title={opcao.activa ? 'Tirar da lista' : 'Repor na lista'}
          >
            {opcao.activa ? (
              <X className="size-4" aria-hidden />
            ) : (
              <RotateCcw className="size-4" aria-hidden />
            )}
          </BotaoSubmeter>
        </form>
      </div>

      {erro ? (
        <p className="mt-1 text-xs text-destructive">{erro.mensagem}</p>
      ) : null}
    </li>
  )
}

/** Acrescenta uma opção à lista sem ter de passar pela ficha de um cavalo. */
export function AdicionarOpcao({ tipo }: { tipo: TipoOpcaoCavalo }) {
  const [resultado, criar] = useActionState(criarOpcaoCavalo, SEM_RESULTADO)
  const campo = useId()

  return (
    <form action={criar} className="space-y-2">
      <input type="hidden" name="tipo" value={tipo} />
      <div className="flex flex-wrap items-center gap-2">
        <Entrada
          id={campo}
          name="valor"
          placeholder={`Acrescentar ${ROTULOS_TIPO_OPCAO[tipo].toLowerCase()}…`}
          aria-label={`Nova ${ROTULOS_TIPO_OPCAO[tipo].toLowerCase()}`}
          className="max-w-xs"
          autoComplete="off"
          required
          // Depois de gravar, o formulário é limpo pela chave do React abaixo.
          key={resultado.ok && resultado.mensagem ? resultado.mensagem : 'campo'}
        />
        <BotaoSubmeter>
          <Plus className="size-4" aria-hidden />
          Acrescentar
        </BotaoSubmeter>
      </div>

      {resultado.mensagem ? (
        <Aviso tom={resultado.ok ? 'sucesso' : 'erro'}>{resultado.mensagem}</Aviso>
      ) : null}
    </form>
  )
}
