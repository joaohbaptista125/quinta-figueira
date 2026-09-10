'use client'

import { useActionState, useRef } from 'react'
import {
  guardarParticipante,
  marcarPresencas,
  removerParticipante,
} from '@/lib/accoes/eventos'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { Selector } from '@/components/ui/campos'
import { Aviso, Distintivo, SemRegistos } from '@/components/ui/superficie'
import { ROTULOS_ESTADO_PARTICIPACAO } from '@/lib/rotulos'
import type { EstadoParticipacao } from '@/lib/tipos-bd'

export type Convocado = {
  id: string
  estado: EstadoParticipacao
  pessoa: { id: string; nome: string } | null
  cavalo: { id: string; nome: string } | null
}

type Opcao = { id: string; nome: string }

const COR_ESTADO: Record<EstadoParticipacao, 'neutro' | 'sucesso' | 'perigo'> = {
  convocado: 'neutro',
  presente: 'sucesso',
  faltou: 'perigo',
  dispensado: 'neutro',
}

export function Convocatoria({
  eventoId,
  convocados,
  pessoas,
  cavalos,
  podeEditar,
}: {
  eventoId: string
  convocados: Convocado[]
  pessoas: Opcao[]
  cavalos: Opcao[]
  podeEditar: boolean
}) {
  const jaConvocados = new Set(convocados.map((c) => c.pessoa?.id))
  const porConvocar = pessoas.filter((p) => !jaConvocados.has(p.id))

  if (convocados.length === 0 && !podeEditar) {
    return <SemRegistos titulo="Ainda ninguém convocado" />
  }

  return (
    <div className="space-y-4">
      {convocados.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {convocados.map((convocado) => (
            <li key={convocado.id} className="p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="min-w-0 flex-1 truncate font-medium">
                  {convocado.pessoa?.nome ?? '—'}
                </span>

                {podeEditar ? (
                  <EscolhaCavalo
                    eventoId={eventoId}
                    convocado={convocado}
                    cavalos={cavalos}
                  />
                ) : (
                  <span className="text-sm">
                    {convocado.cavalo?.nome ?? 'sem cavalo'}
                  </span>
                )}

                <Distintivo cor={COR_ESTADO[convocado.estado]}>
                  {ROTULOS_ESTADO_PARTICIPACAO[convocado.estado]}
                </Distintivo>

                {podeEditar ? (
                  <Remover eventoId={eventoId} id={convocado.id} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {podeEditar ? (
        <>
          {convocados.length > 0 ? (
            <MarcarPresencas eventoId={eventoId} convocados={convocados} />
          ) : null}
          <Convocar
            eventoId={eventoId}
            porConvocar={porConvocar}
            cavalos={cavalos}
          />
        </>
      ) : null}
    </div>
  )
}

/**
 * O cavalo grava assim que é escolhido.
 *
 * Quem distribui cavalos passa por vinte alunos de seguida; obrigar a um botão
 * «Guardar» por linha duplicaria os toques sem nada em troca. A base recusa um
 * cavalo já ocupado à mesma hora, e o erro aparece aqui na linha.
 */
function EscolhaCavalo({
  eventoId,
  convocado,
  cavalos,
}: {
  eventoId: string
  convocado: Convocado
  cavalos: Opcao[]
}) {
  const [resultado, executar] = useActionState(guardarParticipante, SEM_RESULTADO)
  const formulario = useRef<HTMLFormElement>(null)

  return (
    <form ref={formulario} action={executar} className="min-w-0">
      <input type="hidden" name="id" value={convocado.id} />
      <input type="hidden" name="evento_id" value={eventoId} />
      <input type="hidden" name="pessoa_id" value={convocado.pessoa?.id ?? ''} />
      <input type="hidden" name="estado" value={convocado.estado} />

      <Selector
        name="cavalo_id"
        defaultValue={convocado.cavalo?.id ?? ''}
        aria-label={`Cavalo de ${convocado.pessoa?.nome ?? 'participante'}`}
        onChange={() => formulario.current?.requestSubmit()}
        className="h-9 w-44 text-sm"
      >
        <option value="">— sem cavalo —</option>
        {cavalos.map((cavalo) => (
          <option key={cavalo.id} value={cavalo.id}>
            {cavalo.nome}
          </option>
        ))}
      </Selector>

      {resultado.mensagem && !resultado.ok ? (
        <p className="mt-1 text-xs text-destructive">{resultado.mensagem}</p>
      ) : null}
    </form>
  )
}

function Remover({ eventoId, id }: { eventoId: string; id: string }) {
  const [resultado, executar] = useActionState(removerParticipante, SEM_RESULTADO)

  return (
    <form action={executar}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="evento_id" value={eventoId} />
      <Botao
        type="submit"
        variante="fantasma"
        tamanho="pequeno"
        aria-label="Retirar da convocatória"
        title="Retirar da convocatória"
      >
        ✕
      </Botao>
      {resultado.mensagem && !resultado.ok ? (
        <span className="text-xs text-destructive">{resultado.mensagem}</span>
      ) : null}
    </form>
  )
}

function Convocar({
  eventoId,
  porConvocar,
  cavalos,
}: {
  eventoId: string
  porConvocar: Opcao[]
  cavalos: Opcao[]
}) {
  const [resultado, executar] = useActionState(guardarParticipante, SEM_RESULTADO)

  if (porConvocar.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Já estão convocadas todas as pessoas activas.
      </p>
    )
  }

  return (
    <form action={executar} className="space-y-2">
      <input type="hidden" name="evento_id" value={eventoId} />
      <input type="hidden" name="estado" value="convocado" />

      <div className="flex flex-wrap gap-2">
        <Selector
          name="pessoa_id"
          defaultValue=""
          required
          aria-label="Pessoa a convocar"
          className="w-52"
        >
          <option value="">— escolher pessoa —</option>
          {porConvocar.map((pessoa) => (
            <option key={pessoa.id} value={pessoa.id}>
              {pessoa.nome}
            </option>
          ))}
        </Selector>

        <Selector
          name="cavalo_id"
          defaultValue=""
          aria-label="Cavalo"
          className="w-44"
        >
          <option value="">— sem cavalo —</option>
          {cavalos.map((cavalo) => (
            <option key={cavalo.id} value={cavalo.id}>
              {cavalo.nome}
            </option>
          ))}
        </Selector>

        <Botao type="submit" variante="contorno">
          Convocar
        </Botao>
      </div>

      {resultado.mensagem ? (
        <Aviso tom={resultado.ok ? 'sucesso' : 'erro'}>{resultado.mensagem}</Aviso>
      ) : null}
    </form>
  )
}

/** Presenças em bloco: quem não for marcado fica como falta. */
function MarcarPresencas({
  eventoId,
  convocados,
}: {
  eventoId: string
  convocados: Convocado[]
}) {
  const [resultado, executar] = useActionState(marcarPresencas, SEM_RESULTADO)

  return (
    <details className="rounded-md border border-border">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
        Marcar presenças
      </summary>
      <form action={executar} className="space-y-3 border-t border-border p-3">
        <input type="hidden" name="evento_id" value={eventoId} />

        <ul className="space-y-1.5">
          {convocados.map((convocado) => (
            <li key={convocado.id} className="flex items-center gap-2">
              <input type="hidden" name="participantes" value={convocado.id} />
              <input
                type="checkbox"
                id={`presenca-${convocado.id}`}
                name="presentes"
                value={convocado.id}
                defaultChecked={convocado.estado === 'presente'}
                disabled={convocado.estado === 'dispensado'}
                className="size-4 rounded border-input accent-[var(--primary)]"
              />
              <label
                htmlFor={`presenca-${convocado.id}`}
                className="cursor-pointer text-sm"
              >
                {convocado.pessoa?.nome ?? '—'}
                {convocado.estado === 'dispensado' ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    dispensado
                  </span>
                ) : null}
              </label>
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">
          Quem ficar por marcar é registado como falta. Dispensados não são
          alterados.
        </p>

        <Botao type="submit" variante="contorno" tamanho="pequeno">
          Registar
        </Botao>

        {resultado.mensagem ? (
          <Aviso tom={resultado.ok ? 'sucesso' : 'erro'}>
            {resultado.mensagem}
          </Aviso>
        ) : null}
      </form>
    </details>
  )
}
