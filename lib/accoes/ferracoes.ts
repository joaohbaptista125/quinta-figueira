'use server'

import { revalidatePath } from 'next/cache'
import type { TipoFerracao } from '@/lib/tipos-bd'
import { apagar, gravar, texto, textoOuNulo, valorOuNulo } from './comum'
import type { ResultadoAccao } from './resultado'

const TIPOS: TipoFerracao[] = ['completa', 'maos', 'pes', 'arranjo']

/**
 * Regista (ou corrige) uma passagem do ferrador por um cavalo.
 *
 * Quem escreve é a equipa inteira e não só a gestão: quem recebe o ferrador na
 * cavalariça é o tratador, e obrigá-lo a pedir à gestão para registar era a
 * maneira certa de o registo não existir. A RLS é que trava — isto aqui só
 * decide o que mostrar.
 *
 * Fica sempre na ficha do cavalo: não há listagem de ferrações para onde
 * voltar, e a pergunta seguinte é sempre sobre o mesmo cavalo.
 */
export async function guardarFerracao(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = textoOuNulo(dados, 'id')
  const cavaloId = texto(dados, 'cavalo_id')
  const data = texto(dados, 'data')

  if (!cavaloId) return { ok: false, mensagem: 'Cavalo em falta.' }
  if (!data) return { ok: false, mensagem: 'Indique a data da ferração.' }

  const tipoBruto = texto(dados, 'tipo')
  const tipo = TIPOS.includes(tipoBruto as TipoFerracao)
    ? (tipoBruto as TipoFerracao)
    : 'completa'

  const proxima = textoOuNulo(dados, 'proxima_em')
  if (proxima && proxima <= data) {
    // As datas do Postgres são texto AAAA-MM-DD, e por isso comparam-se como
    // texto — passá-las por `new Date()` fá-las saltar um dia conforme o fuso.
    return {
      ok: false,
      mensagem: 'A próxima ferração tem de ser depois desta.',
    }
  }

  const resultado = await gravar({
    tabela: 'ferracoes',
    id,
    valores: {
      cavalo_id: cavaloId,
      data,
      tipo,
      proxima_em: proxima,
      ferrador: textoOuNulo(dados, 'ferrador'),
      custo: valorOuNulo(dados, 'custo'),
      notas: textoOuNulo(dados, 'notas'),
    },
    revalidar: ['/cavalos', `/cavalos/${cavaloId}`],
    mensagemCriado: 'Ferração registada.',
  })

  if (!resultado.ok) return resultado

  revalidatePath('/cavalos')
  revalidatePath(`/cavalos/${cavaloId}`)
  return resultado
}

export async function apagarFerracao(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  const cavaloId = texto(dados, 'cavalo_id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }

  const resultado = await apagar({
    tabela: 'ferracoes',
    id,
    revalidar: ['/cavalos', `/cavalos/${cavaloId}`],
  })

  return resultado.ok ? { ok: true, mensagem: 'Ferração apagada.' } : resultado
}
