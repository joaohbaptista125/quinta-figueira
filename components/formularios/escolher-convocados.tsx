'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Entrada } from '@/components/ui/campos'

/**
 * Quem vai ser convocado, escolhido no próprio formulário de marcação.
 *
 * Antes era preciso marcar o evento, entrar nele e só então convocar um a um
 * — três passos para o que é uma coisa só na cabeça de quem marca: «terça às
 * 18:30, estes quatro».
 *
 * Com ~80 fichas, uma lista de caixas de visto sem filtro não se usa: a caixa
 * de pesquisa é o que torna isto praticável num telemóvel. O filtro é só
 * visual — **quem está marcado continua marcado mesmo quando o filtro o
 * esconde**, porque os campos continuam no formulário. Esconder uma escolha
 * já feita e perdê-la ao gravar seria pior do que não ter filtro nenhum.
 */
export function EscolherConvocados({
  pessoas,
}: {
  pessoas: { id: string; nome: string }[]
}) {
  const [procura, setProcura] = useState('')
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set())

  const visiveis = useMemo(() => {
    const termo = procura.trim().toLowerCase()
    if (!termo) return pessoas
    return pessoas.filter((pessoa) => pessoa.nome.toLowerCase().includes(termo))
  }, [pessoas, procura])

  function alternar(id: string) {
    setEscolhidos((anteriores) => {
      const novos = new Set(anteriores)
      if (novos.has(id)) novos.delete(id)
      else novos.add(id)
      return novos
    })
  }

  if (pessoas.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Entrada
          type="search"
          value={procura}
          onChange={(evento) => setProcura(evento.target.value)}
          placeholder="Procurar pelo nome…"
          aria-label="Procurar pessoa a convocar"
          className="pl-9"
        />
      </div>

      <div className="max-h-64 overflow-y-auto rounded-md border border-input">
        {visiveis.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            Ninguém com esse nome.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visiveis.map((pessoa) => (
              <li key={pessoa.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-accent">
                  <input
                    type="checkbox"
                    name="convocados"
                    value={pessoa.id}
                    checked={escolhidos.has(pessoa.id)}
                    onChange={() => alternar(pessoa.id)}
                    className="size-4 shrink-0 rounded border-input accent-[var(--primary)]"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {pessoa.nome}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/*
        Os escondidos pelo filtro continuam a viajar no formulário. Sem isto,
        escrever um nome na pesquisa depois de ter marcado outros desfazia o
        que já estava escolhido.
      */}
      {[...escolhidos]
        .filter((id) => !visiveis.some((pessoa) => pessoa.id === id))
        .map((id) => (
          <input key={id} type="hidden" name="convocados" value={id} />
        ))}

      <p className="text-xs text-muted-foreground">
        {escolhidos.size === 0
          ? 'Ninguém escolhido — pode convocar depois, na ficha do evento.'
          : `${escolhidos.size} ${escolhidos.size === 1 ? 'pessoa convocada' : 'pessoas convocadas'}. Os cavalos atribuem-se depois, na ficha.`}
      </p>
    </div>
  )
}
