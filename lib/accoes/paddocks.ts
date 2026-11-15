'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { avisar } from '@/lib/notificacoes/enviar'
import { hoje } from '@/lib/formatos'
import { texto, textoOuNulo } from './comum'
import { traduzirErro, type ResultadoAccao } from './resultado'

const CAMINHOS = ['/paddocks', '/']

/**
 * Larga um cavalo num paddock, hoje.
 *
 * Quem escreve é a equipa inteira e não só a gestão — quem larga os cavalos de
 * manhã é o tratador. A RLS é que trava; isto decide só o que mostrar.
 *
 * A data nunca vem do formulário: é sempre hoje. O quadro é o do dia, e deixar
 * escolher a data abria a porta a largar um cavalo em ontem sem dar por isso.
 */
export async function largarNoPaddock(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const paddockId = texto(dados, 'paddock_id')
  const cavaloId = texto(dados, 'cavalo_id')

  if (!paddockId) return { ok: false, mensagem: 'Paddock em falta.' }
  if (!cavaloId) return { ok: false, mensagem: 'Escolha o cavalo.' }

  const supabase = await criarClienteServidor()

  const { error } = await supabase.from('paddock_ocupacao').insert({
    paddock_id: paddockId,
    cavalo_id: cavaloId,
    data: hoje(),
    notas: textoOuNulo(dados, 'notas'),
  })

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  for (const caminho of CAMINHOS) revalidatePath(caminho)
  revalidatePath(`/cavalos/${cavaloId}`)

  await avisarOProprietario(cavaloId, paddockId)

  return { ok: true, mensagem: 'Cavalo largado.' }
}

/** Recolhe um cavalo: a linha de hoje desaparece do quadro. */
export async function recolherDoPaddock(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('paddock_ocupacao').delete().eq('id', id)

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  for (const caminho of CAMINHOS) revalidatePath(caminho)
  revalidatePath('/cavalos')

  // Recolher não avisa ninguém: o dono já soube que o cavalo saiu, e um
  // segundo aviso a dizer que voltou é a maneira de estes avisos passarem a
  // ser ignorados.
  return { ok: true, mensagem: 'Cavalo recolhido.' }
}

/**
 * Avisa o dono de que o cavalo dele está no paddock hoje.
 *
 * Foi o pedido do centro, e é informação e não pergunta: o dono não decide
 * nada a partir daqui. Por isso `avisar()` não trava a largada se falhar —
 * o quadro é que é a verdade, a notificação é cortesia.
 *
 * `agrupar` leva o cavalo e o dia: se o cavalo mudar de campo ao fim da manhã,
 * o telemóvel substitui a notificação em vez de empilhar duas.
 */
async function avisarOProprietario(cavaloId: string, paddockId: string) {
  const supabase = await criarClienteServidor()

  const [cavalo, paddock] = await Promise.all([
    supabase
      .from('cavalos')
      .select('nome, proprietario_id')
      .eq('id', cavaloId)
      .maybeSingle(),
    supabase.from('paddocks').select('numero, nome').eq('id', paddockId).maybeSingle(),
  ])

  const dono = cavalo.data?.proprietario_id
  if (!dono || !paddock.data) return

  const campo = paddock.data.nome
    ? `paddock ${paddock.data.numero} (${paddock.data.nome})`
    : `paddock ${paddock.data.numero}`

  await avisar([dono], {
    titulo: `${cavalo.data?.nome ?? 'O seu cavalo'} está no paddock`,
    texto: `Hoje foi largado no ${campo}.`,
    caminho: `/cavalos/${cavaloId}`,
    agrupar: `paddock-${cavaloId}-${hoje()}`,
  })
}
