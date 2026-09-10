'use client'

import { useState, useTransition } from 'react'
import { obterTokenCalendario } from '@/lib/accoes/calendario'
import { Botao } from '@/components/ui/botao'
import { Aviso } from '@/components/ui/superficie'

/**
 * Endereço de subscrição do calendário.
 *
 * O `webcal://` é o que faz o telemóvel abrir a aplicação de calendário em vez
 * de descarregar um ficheiro. Subscrever é diferente de importar: uma
 * subscrição volta a consultar o endereço de tempos a tempos, por isso
 * remarcar um treino aqui muda-o no telemóvel de toda a gente sem ninguém
 * fazer nada.
 */
export function SubscreverCalendario({
  origem,
  tokenInicial,
}: {
  origem: string
  tokenInicial: string | null
}) {
  const [token, setToken] = useState(tokenInicial)
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aDecorrer, comecar] = useTransition()

  const endereco = token ? `${origem}/calendario/${token}.ics` : null
  const webcal = endereco?.replace(/^https?:/, 'webcal:')

  function pedir(renovar: boolean) {
    setErro(null)
    comecar(async () => {
      const resultado = await obterTokenCalendario(renovar)
      if (resultado.ok) {
        setToken(resultado.token)
        setCopiado(false)
      } else {
        setErro(resultado.mensagem)
      }
    })
  }

  async function copiar() {
    if (!endereco) return
    try {
      await navigator.clipboard.writeText(endereco)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setErro('Copie o endereço à mão — o browser não deixou copiar.')
    }
  }

  if (!endereco) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Ainda não tem endereço de calendário. Crie um e subscreva-o no
          telemóvel; a partir daí, tudo o que lhe for marcado aparece lá.
        </p>
        <Botao onClick={() => pedir(false)} disabled={aDecorrer}>
          {aDecorrer ? 'A criar…' : 'Criar endereço de calendário'}
        </Botao>
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <a href={webcal} className="inline-flex">
          <Botao>Adicionar ao calendário</Botao>
        </a>
        <Botao variante="contorno" onClick={copiar}>
          {copiado ? 'Copiado' : 'Copiar endereço'}
        </Botao>
      </div>

      <p className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs">
        {endereco}
      </p>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          Como subscrever à mão
        </summary>
        <ul className="mt-2 space-y-1 pl-4 text-muted-foreground">
          <li>
            <strong>iPhone</strong> — Definições → Aplicações → Calendário →
            Contas → Adicionar conta → Outra → Adicionar calendário subscrito
          </li>
          <li>
            <strong>Android</strong> — Google Calendar no computador → Outros
            calendários → Subscrever → A partir de URL
          </li>
        </ul>
      </details>

      <Aviso tom="atencao">
        Este endereço é pessoal e não pede palavra-passe: quem o tiver vê a sua
        agenda. Se o partilhar por engano, gere um novo — o antigo deixa de
        funcionar na hora.
      </Aviso>

      <Botao
        variante="fantasma"
        tamanho="pequeno"
        onClick={() => pedir(true)}
        disabled={aDecorrer}
      >
        {aDecorrer ? 'A gerar…' : 'Gerar endereço novo'}
      </Botao>

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
    </div>
  )
}
