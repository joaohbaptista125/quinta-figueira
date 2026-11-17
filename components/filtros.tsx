'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { enderecoComFiltro } from '@/lib/filtros'

/**
 * Pastilhas e interruptores de filtro, sobre os parâmetros do endereço.
 * =============================================================================
 *
 * **Existem para corrigir um defeito, e não só para poupar código.** Os
 * filtros estavam escritos à mão em cada listagem, e cada um construía o
 * endereço de raiz: `/cavalos?regime=penso`. O resultado é que escolher um
 * regime **apagava a pesquisa** que estava escrita, e carregar em «incluir
 * inactivos» apagava o regime. Quem procurava «Lusitano» e depois filtrava
 * por «A penso» via a pesquisa desaparecer sem perceber porquê.
 *
 * Aqui os parâmetros são sempre **copiados e corrigidos**, nunca
 * reconstruídos — é a mesma regra que `<Pesquisa>` já seguia e que faltava
 * do outro lado.
 *
 * São `<Link>` e não botões com JavaScript: funcionam sem ele, abrem-se em
 * separador novo, e o Next pré-carrega-os.
 *
 * **O que não está aqui é a decisão de quando filtrar.** Isso é de cada
 * listagem — por exemplo, uma pesquisa nas despesas sai do mês escolhido e
 * procura em todos, porque quem procura uma factura não sabe de que mês ela
 * era. Ver `app/(painel)/financeiro/despesas/page.tsx`.
 */

/**
 * Liga o gancho à função pura que constrói o endereço.
 *
 * A lógica vive em `lib/filtros.ts` para poder ser testada — e é testada
 * porque foi precisamente ela que esteve errada. Aqui fica só a leitura do
 * caminho e dos parâmetros actuais.
 *
 * Chama-se `use…` e não `usar…` porque a regra do React é sobre o prefixo
 * literal: sem ele o ESLint não o reconhece como gancho e deixa de verificar
 * as regras dos ganchos aqui dentro. É a mesma escolha de
 * `useFormularioDeAccao`.
 */
function useEndereco() {
  const caminho = usePathname()
  const parametros = useSearchParams()

  return (parametro: string, valor: string | undefined) =>
    enderecoComFiltro(caminho, parametros.toString(), parametro, valor)
}

export type OpcaoFiltro = {
  /** `undefined` é a pastilha de «todos», que tira o parâmetro. */
  valor?: string
  rotulo: string
}

export function FiltroPastilhas({
  parametro,
  opcoes,
  rotulo,
}: {
  parametro: string
  opcoes: OpcaoFiltro[]
  /** Nome do grupo para quem navega por leitor de ecrã. */
  rotulo: string
}) {
  const parametros = useSearchParams()
  const enderecoCom = useEndereco()
  const activo = parametros.get(parametro) ?? undefined

  return (
    <div
      role="group"
      aria-label={rotulo}
      className="flex flex-wrap gap-1.5 text-sm"
    >
      {opcoes.map((opcao) => {
        const seleccionado = activo === opcao.valor
        return (
          <Link
            key={opcao.valor ?? 'todos'}
            href={enderecoCom(parametro, opcao.valor)}
            aria-current={seleccionado ? 'true' : undefined}
            className={cn(
              // 44px nos ecrãs de toque, como todos os alvos da aplicação.
              'inline-flex items-center rounded-full px-3.5 py-1.5 transition-colors',
              'min-h-9 pointer-coarse:min-h-11 pointer-coarse:px-4',
              seleccionado
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent active:bg-accent',
            )}
          >
            {opcao.rotulo}
          </Link>
        )
      })}
    </div>
  )
}

/**
 * O interruptor de «incluir o que está fora» — inactivos, terminados.
 *
 * É uma ligação de texto e não uma pastilha de propósito: não é uma escolha
 * entre iguais, é uma excepção que se liga de vez em quando.
 */
export function AlternarFiltro({
  parametro,
  rotuloLigado,
  rotuloDesligado,
}: {
  parametro: string
  /** O que se lê quando o filtro está ligado (e o toque desliga-o). */
  rotuloLigado: string
  rotuloDesligado: string
}) {
  const parametros = useSearchParams()
  const enderecoCom = useEndereco()
  const ligado = parametros.get(parametro) === '1'

  return (
    <Link
      href={enderecoCom(parametro, ligado ? undefined : '1')}
      className="inline-flex min-h-9 items-center text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground pointer-coarse:min-h-11"
    >
      {ligado ? rotuloLigado : rotuloDesligado}
    </Link>
  )
}
