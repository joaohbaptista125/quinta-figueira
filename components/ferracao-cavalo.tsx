'use client'

import { useActionState, useId } from 'react'
import { useFormStatus } from 'react-dom'
import { Hammer } from 'lucide-react'
import { guardarFerracao } from '@/lib/accoes/ferracoes'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { Campo, AreaTexto, Entrada, Selector } from '@/components/ui/campos'
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
import { ROTULOS_TIPO_FERRACAO } from '@/lib/rotulos'
import { deslocarDias, diasAte, formatarData, hoje } from '@/lib/formatos'
import type { Ferracao, TipoFerracao } from '@/lib/tipos-bd'

/** Seis semanas é o intervalo normal, e é o que o ferrador combina à saída. */
const SEMANAS_ATE_A_PROXIMA = 6

const TIPOS: TipoFerracao[] = ['completa', 'maos', 'pes', 'arranjo']

type LinhaFerracao = Pick<
  Ferracao,
  'id' | 'data' | 'tipo' | 'proxima_em' | 'ferrador' | 'custo' | 'notas'
>

/**
 * Ferração de um cavalo: quando foi, de que tipo, e quando volta a ser.
 *
 * O caderno do ferrador vivia na cavalariça e o que falhava era sempre o
 * mesmo — o cavalo que ficou de fora da última volta. Por isso o que está em
 * cima não é a lista: é a resposta à pergunta de quem está a olhar para o
 * cavalo, e a lista vem a seguir.
 *
 * Quem regista é a equipa inteira: quem recebe o ferrador é o tratador.
 */
export function FerracaoCavalo({
  cavaloId,
  ferracoes,
  podeRegistar,
}: {
  cavaloId: string
  ferracoes: LinhaFerracao[]
  podeRegistar: boolean
}) {
  const ultima = ferracoes[0] ?? null

  return (
    <Cartao>
      <CabecalhoCartao>
        <TituloCartao className="flex items-center gap-2">
          <Hammer className="size-4 text-muted-foreground" aria-hidden />
          Ferração
        </TituloCartao>
        <DescricaoCartao>
          <EstadoDaFerracao ultima={ultima} />
        </DescricaoCartao>
      </CabecalhoCartao>

      <ConteudoCartao className="space-y-3">
        {podeRegistar ? (
          <FormularioFerracao cavaloId={cavaloId} ultima={ultima} />
        ) : null}

        {ferracoes.length > 0 ? (
          <ol className="divide-y divide-border rounded-md border border-border">
            {ferracoes.map((ferracao) => (
              <li key={ferracao.id} className="px-3 py-2 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="tabular font-medium">
                    {formatarData(ferracao.data)}
                  </span>
                  <Distintivo>{ROTULOS_TIPO_FERRACAO[ferracao.tipo]}</Distintivo>
                  {ferracao.ferrador ? (
                    <span className="text-muted-foreground">
                      {ferracao.ferrador}
                    </span>
                  ) : null}
                </div>
                {ferracao.proxima_em || ferracao.notas ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {ferracao.proxima_em
                      ? `Próxima marcada para ${formatarData(ferracao.proxima_em)}`
                      : null}
                    {ferracao.proxima_em && ferracao.notas ? ' · ' : null}
                    {ferracao.notas}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <SemRegistos
            titulo="Sem ferrações registadas"
            descricao={
              podeRegistar
                ? 'Registe a última passagem do ferrador para saber quando é a próxima.'
                : 'Ainda não há nenhuma passagem do ferrador registada neste cavalo.'
            }
          />
        )}
      </ConteudoCartao>
    </Cartao>
  )
}

/**
 * A frase que responde à pergunta, antes de haver lista nenhuma.
 *
 * O estado é calculado aqui e também existe na vista `v_ferracao_cavalos`,
 * que serve a listagem — a ficha já tem as ferrações todas na mão e não vale
 * uma consulta extra para repetir a mesma conta.
 */
function EstadoDaFerracao({ ultima }: { ultima: LinhaFerracao | null }) {
  if (!ultima) return <>Nunca foi registada uma ferração neste cavalo.</>

  const desde = diasAte(ultima.data, hoje())
  const haQuanto =
    desde === 0
      ? 'hoje'
      : desde === 1
        ? 'ontem'
        : desde < 7
          ? `há ${desde} dias`
          : `há ${Math.round(desde / 7)} semanas`

  if (!ultima.proxima_em) {
    return (
      <>
        Ferrado {haQuanto}, a {formatarData(ultima.data)}.{' '}
        <span className="text-warning-foreground">Sem próxima marcada.</span>
      </>
    )
  }

  const faltam = diasAte(hoje(), ultima.proxima_em)

  return (
    <>
      Ferrado {haQuanto}.{' '}
      {faltam < 0 ? (
        <span className="font-medium text-destructive">
          A próxima era a {formatarData(ultima.proxima_em)} — está atrasada{' '}
          {-faltam === 1 ? '1 dia' : `${-faltam} dias`}.
        </span>
      ) : faltam === 0 ? (
        <span className="font-medium text-warning-foreground">
          A próxima é hoje.
        </span>
      ) : faltam <= 7 ? (
        <span className="font-medium text-warning-foreground">
          A próxima é {faltam === 1 ? 'amanhã' : `daqui a ${faltam} dias`}, a{' '}
          {formatarData(ultima.proxima_em)}.
        </span>
      ) : (
        <>Próxima a {formatarData(ultima.proxima_em)}.</>
      )}
    </>
  )
}

function BotaoRegistar() {
  const { pending } = useFormStatus()
  return (
    <Botao type="submit" disabled={pending}>
      {pending ? 'A registar…' : 'Registar ferração'}
    </Botao>
  )
}

function FormularioFerracao({
  cavaloId,
  ultima,
}: {
  cavaloId: string
  ultima: LinhaFerracao | null
}) {
  const [resultado, executar] = useActionState(guardarFerracao, SEM_RESULTADO)
  const prefixo = useId()
  const dia = hoje()

  return (
    <details className="rounded-md border border-border">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-primary">
        Registar ferração
      </summary>

      <form action={executar} className="space-y-3 border-t border-border p-3">
        <input type="hidden" name="cavalo_id" value={cavaloId} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Data" htmlFor={`${prefixo}-data`}>
            <Entrada
              type="date"
              id={`${prefixo}-data`}
              name="data"
              defaultValue={dia}
              max={dia}
              required
            />
          </Campo>

          <Campo etiqueta="O que foi feito" htmlFor={`${prefixo}-tipo`}>
            <Selector
              id={`${prefixo}-tipo`}
              name="tipo"
              defaultValue={ultima?.tipo ?? 'completa'}
            >
              {TIPOS.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ROTULOS_TIPO_FERRACAO[tipo]}
                </option>
              ))}
            </Selector>
          </Campo>

          <Campo
            etiqueta="Próxima ferração"
            htmlFor={`${prefixo}-proxima`}
            ajuda="Seis semanas é o normal — mude se o ferrador combinou outra coisa."
          >
            <Entrada
              type="date"
              id={`${prefixo}-proxima`}
              name="proxima_em"
              defaultValue={deslocarDias(dia, SEMANAS_ATE_A_PROXIMA * 7)}
            />
          </Campo>

          <Campo etiqueta="Ferrador" htmlFor={`${prefixo}-ferrador`}>
            <Entrada
              id={`${prefixo}-ferrador`}
              name="ferrador"
              defaultValue={ultima?.ferrador ?? ''}
              placeholder="Quem ferrou"
            />
          </Campo>

          <Campo etiqueta="Custo" htmlFor={`${prefixo}-custo`}>
            <Entrada
              id={`${prefixo}-custo`}
              name="custo"
              inputMode="decimal"
              placeholder="0,00"
            />
          </Campo>
        </div>

        <Campo etiqueta="Notas" htmlFor={`${prefixo}-notas`}>
          <AreaTexto id={`${prefixo}-notas`} name="notas" rows={2} />
        </Campo>

        <p className="text-xs text-muted-foreground">
          O custo fica aqui como nota do que foi combinado. A despesa do
          ferrador lança-se no financeiro, imputada a este cavalo.
        </p>

        <BotaoRegistar />

        {resultado.mensagem ? (
          <Aviso tom={resultado.ok ? 'sucesso' : 'erro'}>
            {resultado.mensagem}
          </Aviso>
        ) : null}
      </form>
    </details>
  )
}
