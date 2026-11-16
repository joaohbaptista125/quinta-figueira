'use client'

import { useActionState, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { ClipboardCheck } from 'lucide-react'
import { aprovarCavalo, recusarCavalo } from '@/lib/accoes/cavalos'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { AreaTexto, Campo } from '@/components/ui/campos'
import {
  Aviso,
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  TituloCartao,
} from '@/components/ui/superficie'

/**
 * Aprovar ou recusar uma ficha que o cliente inscreveu.
 * =============================================================================
 *
 * Aparece na ficha do cavalo, à gestão, e só enquanto `aprovado_em` for nulo.
 *
 * As duas saídas não são simétricas de propósito: **aprovar é um toque** —
 * é o caso normal, e a ficha já está à frente de quem decide — e **recusar
 * pede o motivo**, porque apaga a ficha e o motivo é a única coisa que o
 * cliente vai receber. Sem ele, o cavalo que ele inscreveu desaparecia sem
 * explicação nenhuma, que é a pior maneira de o perder.
 */
export function DecidirCavalo({
  cavaloId,
  nome,
  proposto,
}: {
  cavaloId: string
  nome: string
  /** Quem inscreveu, se não for o próprio proprietário. */
  proposto: string | null
}) {
  const [aRecusar, setARecusar] = useState(false)

  return (
    <Cartao className="border-warning/40">
      <CabecalhoCartao>
        <TituloCartao className="flex items-center gap-2">
          <ClipboardCheck className="size-4 text-warning-foreground" aria-hidden />
          Ficha por aprovar
        </TituloCartao>
        <DescricaoCartao>
          {proposto ? `Inscrita por ${proposto}.` : 'Inscrita pelo proprietário.'}{' '}
          Enquanto não for aprovada, {nome} não aparece para contratos nem para
          convocatórias.
        </DescricaoCartao>
      </CabecalhoCartao>

      <ConteudoCartao className="space-y-3">
        {aRecusar ? (
          <Recusar
            cavaloId={cavaloId}
            aoDesistir={() => setARecusar(false)}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            <Aprovar cavaloId={cavaloId} />
            <Botao variante="contorno" onClick={() => setARecusar(true)}>
              Recusar
            </Botao>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Confirme o regime, o proprietário e quem paga o ferrador nos dados ao
          lado — esses campos são da gestão e o cliente não lhes toca.
        </p>
      </ConteudoCartao>
    </Cartao>
  )
}

function Aprovar({ cavaloId }: { cavaloId: string }) {
  const [resultado, executar] = useActionState(aprovarCavalo, SEM_RESULTADO)

  return (
    <form action={executar} className="contents">
      <input type="hidden" name="id" value={cavaloId} />
      <BotaoAprovar />
      {resultado.mensagem && !resultado.ok ? (
        <Aviso tom="erro" className="w-full">
          {resultado.mensagem}
        </Aviso>
      ) : null}
    </form>
  )
}

function BotaoAprovar() {
  const { pending } = useFormStatus()
  return (
    <Botao type="submit" disabled={pending}>
      {pending ? 'A aprovar…' : 'Aprovar ficha'}
    </Botao>
  )
}

function Recusar({
  cavaloId,
  aoDesistir,
}: {
  cavaloId: string
  aoDesistir: () => void
}) {
  const [resultado, executar] = useActionState(recusarCavalo, SEM_RESULTADO)
  const prefixo = useId()

  return (
    <form action={executar} className="space-y-3">
      <input type="hidden" name="id" value={cavaloId} />

      <Campo
        etiqueta="Porquê?"
        htmlFor={`${prefixo}-motivo`}
        obrigatorio
        ajuda="Vai inteiro para o cliente. A ficha é apagada."
      >
        <AreaTexto
          id={`${prefixo}-motivo`}
          name="motivo"
          rows={3}
          required
          autoFocus
          placeholder="Ex.: este cavalo já está registado com outro nome."
        />
      </Campo>

      <div className="flex flex-wrap gap-2">
        <BotaoRecusar />
        <Botao variante="fantasma" onClick={aoDesistir}>
          Voltar atrás
        </Botao>
      </div>

      {resultado.mensagem && !resultado.ok ? (
        <Aviso tom="erro">{resultado.mensagem}</Aviso>
      ) : null}
    </form>
  )
}

function BotaoRecusar() {
  const { pending } = useFormStatus()
  return (
    <Botao type="submit" variante="destrutivo" disabled={pending}>
      {pending ? 'A recusar…' : 'Recusar e avisar'}
    </Botao>
  )
}
