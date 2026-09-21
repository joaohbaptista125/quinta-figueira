/**
 * Raças e pelagens: o que é partilhado entre o formulário e a Server Action.
 *
 * Vive à parte de `lib/accoes/` porque o componente do selector corre no
 * browser e não pode importar nada que arraste o cliente de servidor do
 * Supabase atrás de si.
 */

import type { TipoOpcaoCavalo } from '@/lib/tipos-bd'

/**
 * Valor do `<option>` que abre a caixa para escrever uma raça nova.
 *
 * Tem de ser um valor que nunca possa ser uma raça ou uma pelagem de verdade,
 * porque viaja no mesmo campo do formulário que as opções reais.
 */
export const VALOR_NOVA = '__nova__'

export const ROTULOS_TIPO_OPCAO: Record<TipoOpcaoCavalo, string> = {
  raca: 'Raça',
  pelagem: 'Pelagem',
}

export const ROTULOS_TIPO_OPCAO_PLURAL: Record<TipoOpcaoCavalo, string> = {
  raca: 'Raças',
  pelagem: 'Pelagens',
}

export const TIPOS_OPCAO = Object.keys(
  ROTULOS_TIPO_OPCAO,
) as TipoOpcaoCavalo[]

/**
 * Prepara um valor escrito à mão para entrar na lista.
 *
 * Só espaços: o índice único da base ignora caixa e espaços das pontas, por
 * isso «  Lusitano » e «lusitano» colidem lá — mas quem escreve merece ver
 * gravado o que escreveu, sem os espaços a mais.
 */
export function normalizarOpcao(valor: string): string {
  return valor.replace(/\s+/g, ' ').trim()
}
