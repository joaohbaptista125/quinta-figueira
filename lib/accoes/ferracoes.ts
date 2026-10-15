'use server'

import { revalidatePath } from 'next/cache'
import type { TipoFerracao } from '@/lib/tipos-bd'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { ROTULOS_TIPO_FERRACAO } from '@/lib/rotulos'
import { formatarData } from '@/lib/formatos'
import {
  apagar,
  booleano,
  gravar,
  texto,
  textoOuNulo,
  valorOuNulo,
} from './comum'
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

  if (!resultado.ok || !resultado.id) return resultado

  const aviso = await cobrarAoProprietario({
    ferracaoId: resultado.id,
    cavaloId,
    cobrar: booleano(dados, 'cobrar'),
    custo: valorOuNulo(dados, 'custo'),
    data,
    tipo,
  })

  revalidatePath('/cavalos')
  revalidatePath(`/cavalos/${cavaloId}`)
  revalidatePath('/pagamentos')

  return aviso ? { ...resultado, mensagem: `${resultado.mensagem} ${aviso}` } : resultado
}

/**
 * Põe a ferração na conta do dono do cavalo, quando é o centro que recobra.
 *
 * Na Quinta da Figueira depende do cliente: uns pagam ao ferrador na hora,
 * outros vai à conta do centro. Por isso é uma escolha no formulário e não
 * uma regra — e por isso o encargo é uma linha à parte e não um campo da
 * ferração: é dinheiro que alguém deve, e segue a vida dele.
 *
 * Devolve um aviso quando não conseguiu cobrar, para a mensagem de sucesso
 * não mentir. O índice único de `ferracao_id` trata do resto: carregar duas
 * vezes no botão não cobra duas vezes.
 */
async function cobrarAoProprietario({
  ferracaoId,
  cavaloId,
  cobrar,
  custo,
  data,
  tipo,
}: {
  ferracaoId: string
  cavaloId: string
  cobrar: boolean
  custo: number | null
  data: string
  tipo: TipoFerracao
}): Promise<string | null> {
  if (!cobrar) return null
  if (custo == null || custo <= 0) {
    return 'Não foi cobrada a ninguém: faltava o custo.'
  }

  const supabase = await criarClienteServidor()
  const { data: cavalo } = await supabase
    .from('cavalos')
    .select('nome, proprietario_id')
    .eq('id', cavaloId)
    .maybeSingle()

  if (!cavalo?.proprietario_id) {
    return 'Não foi cobrada a ninguém: este cavalo não tem proprietário na ficha.'
  }

  const { error } = await supabase.from('encargos').insert({
    pessoa_id: cavalo.proprietario_id,
    cavalo_id: cavaloId,
    ferracao_id: ferracaoId,
    descricao: `${ROTULOS_TIPO_FERRACAO[tipo]} — ${cavalo.nome}, ${formatarData(data)}`,
    valor: custo,
    data,
  })

  // 23505: já estava cobrada. É o que se queria, não é erro.
  if (error && error.code !== '23505') {
    return 'A ferração ficou registada, mas não foi possível pô-la na conta do proprietário.'
  }

  return null
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
