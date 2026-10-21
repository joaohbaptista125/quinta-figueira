'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import {
  ROTULOS_ESTADO_PARTICIPACAO,
  ROTULOS_TIPO_EVENTO,
  ROTULOS_TIPO_EVENTO_CURTO,
} from '@/lib/rotulos'
import { deslocarDias, formatarDiaCurto, formatarHora } from '@/lib/formatos'
import { avisar } from '@/lib/notificacoes/enviar'
import type { EstadoParticipacao, TipoEvento } from '@/lib/tipos-bd'
import {
  apagar,
  comConfirmacao,
  booleano,
  gravar,
  inteiroOuNulo,
  listaTexto,
  querContinuar,
  texto,
  textoOuNulo,
} from './comum'
import { traduzirErro, type ResultadoAccao } from './resultado'

const TIPOS = Object.keys(ROTULOS_TIPO_EVENTO) as TipoEvento[]
const ESTADOS = Object.keys(ROTULOS_ESTADO_PARTICIPACAO) as EstadoParticipacao[]

/** Caminhos que mostram eventos e ficam desactualizados com qualquer mudança. */
const CAMINHOS = ['/agenda', '/equipas', '/']

// --- Eventos ----------------------------------------------------------------

export async function guardarEvento(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = textoOuNulo(dados, 'id')
  const tipo = texto(dados, 'tipo')
  const data = textoOuNulo(dados, 'data')
  const horaInicio = textoOuNulo(dados, 'hora_inicio')

  if (!TIPOS.includes(tipo as TipoEvento)) {
    return { ok: false, mensagem: 'Escolha o tipo de evento.' }
  }
  if (!data) return { ok: false, mensagem: 'Indique a data.' }
  if (!horaInicio) return { ok: false, mensagem: 'Indique a hora de início.' }

  const horaFim = textoOuNulo(dados, 'hora_fim')
  if (horaFim && horaFim <= horaInicio) {
    return {
      ok: false,
      mensagem: 'A hora de fim tem de ser posterior à de início.',
    }
  }

  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const equipaId = textoOuNulo(dados, 'equipa_id')

  // Repetir só faz sentido ao marcar. Numa edição o campo nem aparece: mudar
  // a hora de uma aula não devia criar sete aulas novas.
  const semanas = id ? 1 : Math.min(Math.max(inteiroOuNulo(dados, 'semanas') ?? 1, 1), 52)
  const serieId = semanas > 1 ? crypto.randomUUID() : null

  const comuns = {
    tipo: tipo as TipoEvento,
    titulo: textoOuNulo(dados, 'titulo'),
    hora_inicio: horaInicio,
    hora_fim: horaFim,
    local: textoOuNulo(dados, 'local'),
    responsavel_id: textoOuNulo(dados, 'responsavel_id'),
    equipa_id: equipaId,
    notas: textoOuNulo(dados, 'notas'),
  }

  const resultado = await gravar({
    tabela: 'eventos',
    id,
    valores: {
      ...comuns,
      data,
      serie_id: serieId,
      ...(id ? {} : { criado_por: user?.id ?? null }),
    },
    revalidar: CAMINHOS,
    mensagemCriado: 'Evento criado. Pode marcar já o seguinte.',
  })

  if (!resultado.ok || !resultado.id) return resultado

  const criados = [resultado.id]

  // As repetições são linhas independentes com a mesma etiqueta: cancelar uma
  // não mexe nas outras, e é isso que se quer quando a aula de 4 de Novembro
  // cai por causa da chuva.
  if (semanas > 1) {
    const { data: seguintes, error } = await supabase
      .from('eventos')
      .insert(
        Array.from({ length: semanas - 1 }, (_, i) => ({
          ...comuns,
          data: deslocarDias(data, (i + 1) * 7),
          serie_id: serieId,
          criado_por: user?.id ?? null,
        })),
      )
      .select('id')

    if (error) {
      return {
        ok: true,
        mensagem: `A primeira marcação ficou feita, mas as repetições falharam: ${traduzirErro(error)}`,
      }
    }

    criados.push(...(seguintes ?? []).map((evento) => evento.id))
  }

  // Marcar a equipa num evento novo convoca-a: é o atalho que evita escolher
  // os mesmos oito jogadores todas as semanas. Com repetição, convoca em
  // todas — senão a repetição só poupava metade do trabalho.
  if (!id && equipaId) {
    for (const eventoId of criados) {
      const erro = await convocarMembrosDaEquipa(eventoId, equipaId)
      if (erro) {
        return {
          ok: true,
          mensagem: `Marcações criadas, mas a convocatória falhou: ${erro}`,
        }
      }
    }
  }

  for (const eventoId of criados) revalidatePath(`/agenda/${eventoId}`)

  if (querContinuar(dados)) {
    return semanas > 1
      ? { ...resultado, mensagem: `${semanas} marcações criadas, de semana a semana.` }
      : resultado
  }

  redirect(comConfirmacao(`/agenda/${resultado.id}`, id ? 'guardado' : 'criado'))
}

/**
 * Copia os convocados deste evento para as marcações seguintes da série.
 *
 * É o passo que falta à repetição: marcar oito terças de uma vez não serve de
 * nada se depois for preciso convocar os mesmos quatro alunos oito vezes.
 *
 * Um cavalo já ocupado à mesma hora noutro evento faz falhar **essa linha** e
 * mais nenhuma — a restrição de exclusão trata disso —, e a mensagem diz
 * quantas ficaram por fora em vez de fingir que correu tudo bem.
 */
export async function copiarConvocatoriaDaSerie(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const eventoId = texto(dados, 'evento_id')
  if (!eventoId) return { ok: false, mensagem: 'Registo inválido.' }

  const supabase = await criarClienteServidor()

  const { data: evento } = await supabase
    .from('eventos')
    .select('serie_id, data')
    .eq('id', eventoId)
    .maybeSingle()

  if (!evento?.serie_id) {
    return { ok: false, mensagem: 'Esta marcação não faz parte de nenhuma série.' }
  }

  const [convocados, seguintes] = await Promise.all([
    supabase
      .from('evento_participantes')
      .select('pessoa_id, cavalo_id')
      .eq('evento_id', eventoId),
    supabase
      .from('eventos')
      .select('id')
      .eq('serie_id', evento.serie_id)
      .gt('data', evento.data)
      .eq('cancelado', false),
  ])

  const lista = convocados.data ?? []
  const destinos = seguintes.data ?? []

  if (lista.length === 0) {
    return { ok: false, mensagem: 'Não há ninguém convocado para copiar.' }
  }
  if (destinos.length === 0) {
    return { ok: false, mensagem: 'Não há marcações seguintes nesta série.' }
  }

  let falhadas = 0
  for (const destino of destinos) {
    for (const convocado of lista) {
      const { error } = await supabase.from('evento_participantes').upsert(
        {
          evento_id: destino.id,
          pessoa_id: convocado.pessoa_id,
          cavalo_id: convocado.cavalo_id,
        },
        { onConflict: 'evento_id,pessoa_id', ignoreDuplicates: true },
      )
      if (error) falhadas += 1
    }
    revalidatePath(`/agenda/${destino.id}`)
  }

  for (const caminho of CAMINHOS) revalidatePath(caminho)

  const quantas = destinos.length === 1 ? '1 marcação' : `${destinos.length} marcações`

  return {
    ok: true,
    mensagem:
      falhadas > 0
        ? `Copiado para ${quantas}, com ${falhadas} por fora — quase sempre um cavalo já ocupado nessa hora. Confirme as datas em falta.`
        : `Copiado para ${quantas}.`,
  }
}

/** Cancela as marcações seguintes da mesma série. A desta fica como está. */
export async function cancelarSeguintesDaSerie(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const eventoId = texto(dados, 'evento_id')
  const motivo = textoOuNulo(dados, 'motivo')
  if (!eventoId) return { ok: false, mensagem: 'Registo inválido.' }

  const supabase = await criarClienteServidor()

  const { data: evento } = await supabase
    .from('eventos')
    .select('serie_id, data')
    .eq('id', eventoId)
    .maybeSingle()

  if (!evento?.serie_id) {
    return { ok: false, mensagem: 'Esta marcação não faz parte de nenhuma série.' }
  }

  const { data: cancelados, error } = await supabase
    .from('eventos')
    .update({ cancelado: true, motivo_cancelamento: motivo })
    .eq('serie_id', evento.serie_id)
    .gt('data', evento.data)
    .eq('cancelado', false)
    .select('id')

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  const quantas = (cancelados ?? []).length
  if (quantas === 0) {
    return { ok: false, mensagem: 'Não havia marcações seguintes por cancelar.' }
  }

  for (const cancelado of cancelados ?? []) revalidatePath(`/agenda/${cancelado.id}`)
  for (const caminho of CAMINHOS) revalidatePath(caminho)

  return {
    ok: true,
    mensagem:
      quantas === 1
        ? '1 marcação seguinte cancelada.'
        : `${quantas} marcações seguintes canceladas.`,
  }
}

/** Acrescenta ao evento quem ainda não estiver convocado. */
async function convocarMembrosDaEquipa(eventoId: string, equipaId: string) {
  const supabase = await criarClienteServidor()

  const { data: membros, error: erroMembros } = await supabase
    .from('equipa_membros')
    .select('pessoa_id')
    .eq('equipa_id', equipaId)

  if (erroMembros) return traduzirErro(erroMembros)
  if (!membros || membros.length === 0) return null

  const { error } = await supabase.from('evento_participantes').upsert(
    membros.map((membro) => ({
      evento_id: eventoId,
      pessoa_id: membro.pessoa_id,
    })),
    { onConflict: 'evento_id,pessoa_id', ignoreDuplicates: true },
  )

  return error ? traduzirErro(error) : null
}

export async function convocarEquipa(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const eventoId = texto(dados, 'evento_id')
  const equipaId = texto(dados, 'equipa_id')
  if (!eventoId || !equipaId) {
    return { ok: false, mensagem: 'Escolha a equipa a convocar.' }
  }

  const erro = await convocarMembrosDaEquipa(eventoId, equipaId)
  if (erro) return { ok: false, mensagem: erro }

  revalidatePath(`/agenda/${eventoId}`)
  return { ok: true, mensagem: 'Equipa convocada.' }
}

export async function cancelarEvento(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }

  const cancelar = booleano(dados, 'cancelar')

  const supabase = await criarClienteServidor()
  const { error } = await supabase
    .from('eventos')
    .update({
      cancelado: cancelar,
      motivo_cancelamento: cancelar ? textoOuNulo(dados, 'motivo') : null,
    })
    .eq('id', id)

  if (error) {
    // Reabrir pode colidir: entretanto o cavalo pode ter ido para outro sítio.
    return { ok: false, mensagem: traduzirErro(error) }
  }

  for (const caminho of [...CAMINHOS, `/agenda/${id}`]) revalidatePath(caminho)
  return {
    ok: true,
    mensagem: cancelar ? 'Evento cancelado.' : 'Evento reaberto.',
  }
}

export async function apagarEvento(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }
  const resultado = await apagar({ tabela: 'eventos', id, revalidar: CAMINHOS })
  if (!resultado.ok) return resultado
  redirect(comConfirmacao('/agenda', 'apagado'))
}

// --- Convocatória -----------------------------------------------------------

export async function guardarParticipante(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const eventoId = texto(dados, 'evento_id')
  const pessoaId = textoOuNulo(dados, 'pessoa_id')
  if (!eventoId) return { ok: false, mensagem: 'Registo inválido.' }
  if (!pessoaId) return { ok: false, mensagem: 'Escolha a pessoa.' }

  const id = textoOuNulo(dados, 'id')
  const estado = texto(dados, 'estado')

  const resultado = await gravar({
    tabela: 'evento_participantes',
    id,
    valores: {
      evento_id: eventoId,
      pessoa_id: pessoaId,
      cavalo_id: textoOuNulo(dados, 'cavalo_id'),
      estado: ESTADOS.includes(estado as EstadoParticipacao)
        ? estado
        : 'convocado',
      notas: textoOuNulo(dados, 'notas'),
    },
    revalidar: [...CAMINHOS, `/agenda/${eventoId}`],
    mensagemCriado: 'Convocado.',
    mensagemActualizado: 'Actualizado.',
  })

  // Só na convocatória, e não em cada correcção de hora ou de cavalo: é o
  // aviso mais frequente da aplicação, e notificação a mais ensina a ignorar
  // notificações.
  if (resultado.ok && !id) await avisarConvocado(eventoId, pessoaId)

  return resultado
}

/** Diz a quem foi convocado o que é, quando e onde. */
async function avisarConvocado(eventoId: string, pessoaId: string) {
  const supabase = await criarClienteServidor()
  const { data: evento } = await supabase
    .from('eventos')
    .select('tipo, titulo, data, hora_inicio, local, cancelado')
    .eq('id', eventoId)
    .maybeSingle()

  if (!evento || evento.cancelado) return

  const quando = `${formatarDiaCurto(evento.data)} às ${formatarHora(evento.hora_inicio)}`

  await avisar([pessoaId], {
    titulo: evento.titulo
      ? `${ROTULOS_TIPO_EVENTO_CURTO[evento.tipo]}: ${evento.titulo}`
      : `Foi convocado para ${ROTULOS_TIPO_EVENTO_CURTO[evento.tipo].toLowerCase()}`,
    texto: evento.local ? `${quando} · ${evento.local}` : quando,
    caminho: `/agenda/${eventoId}`,
    agrupar: `evento-${eventoId}`,
  })
}

export async function removerParticipante(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  const eventoId = texto(dados, 'evento_id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }

  return apagar({
    tabela: 'evento_participantes',
    id,
    revalidar: [...CAMINHOS, `/agenda/${eventoId}`],
  })
}

/** Marca presenças em bloco, a partir do quadro do evento. */
export async function marcarPresencas(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const eventoId = texto(dados, 'evento_id')
  if (!eventoId) return { ok: false, mensagem: 'Registo inválido.' }

  const presentes = new Set(listaTexto(dados, 'presentes'))
  const todos = listaTexto(dados, 'participantes')
  if (todos.length === 0) return { ok: true }

  const supabase = await criarClienteServidor()

  for (const estado of ['presente', 'faltou'] as const) {
    const ids = todos.filter((id) =>
      estado === 'presente' ? presentes.has(id) : !presentes.has(id),
    )
    if (ids.length === 0) continue

    const { error } = await supabase
      .from('evento_participantes')
      .update({ estado })
      // Não mexer em quem foi dispensado: isso é uma decisão, não uma falta.
      .neq('estado', 'dispensado')
      .in('id', ids)

    if (error) return { ok: false, mensagem: traduzirErro(error) }
  }

  revalidatePath(`/agenda/${eventoId}`)
  revalidatePath('/agenda')
  return { ok: true, mensagem: 'Presenças registadas.' }
}

// --- Avisos -----------------------------------------------------------------

export async function guardarAviso(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const conteudo = texto(dados, 'texto')
  const eventoId = textoOuNulo(dados, 'evento_id')
  const equipaId = textoOuNulo(dados, 'equipa_id')

  if (!conteudo) return { ok: false, mensagem: 'Escreva o aviso.' }
  if (!eventoId && !equipaId) {
    return { ok: false, mensagem: 'O aviso tem de pertencer a um evento ou equipa.' }
  }

  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: autor } = await supabase
    .from('pessoas')
    .select('id')
    .eq('auth_user_id', user?.id ?? '')
    .maybeSingle()

  const { error } = await supabase.from('avisos').insert({
    evento_id: eventoId,
    equipa_id: equipaId,
    texto: conteudo,
    autor_id: autor?.id ?? null,
    criado_por: user?.id ?? null,
  })

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  revalidatePath(eventoId ? `/agenda/${eventoId}` : `/equipas/${equipaId}`)
  revalidatePath('/agenda')
  return { ok: true, mensagem: 'Aviso publicado.' }
}

export async function apagarAviso(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }
  return apagar({
    tabela: 'avisos',
    id,
    revalidar: [...CAMINHOS, textoOuNulo(dados, 'voltar') ?? '/agenda'],
  })
}

// --- Equipas ----------------------------------------------------------------

export async function guardarEquipa(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = textoOuNulo(dados, 'id')
  const nome = texto(dados, 'nome')
  if (!nome) return { ok: false, mensagem: 'O nome da equipa é obrigatório.' }

  const resultado = await gravar({
    tabela: 'equipas',
    id,
    valores: {
      nome,
      escalao: textoOuNulo(dados, 'escalao'),
      notas: textoOuNulo(dados, 'notas'),
      activa: booleano(dados, 'activa'),
    },
    revalidar: ['/equipas'],
    mensagemCriado: `Equipa ${nome} criada.`,
  })

  if (!resultado.ok || !resultado.id) return resultado

  const erro = await sincronizarMembros(resultado.id, listaTexto(dados, 'membros'))
  if (erro) return { ok: false, mensagem: erro }

  revalidatePath(`/equipas/${resultado.id}`)
  if (querContinuar(dados)) return resultado
  redirect(comConfirmacao(`/equipas/${resultado.id}`, id ? 'guardado' : 'criado'))
}

async function sincronizarMembros(equipaId: string, pessoas: string[]) {
  const supabase = await criarClienteServidor()

  const remocao = supabase
    .from('equipa_membros')
    .delete()
    .eq('equipa_id', equipaId)
  const { error: erroApagar } =
    pessoas.length > 0
      ? await remocao.not('pessoa_id', 'in', `(${pessoas.join(',')})`)
      : await remocao

  if (erroApagar) return traduzirErro(erroApagar)
  if (pessoas.length === 0) return null

  const { error } = await supabase.from('equipa_membros').upsert(
    pessoas.map((pessoa_id) => ({ equipa_id: equipaId, pessoa_id })),
    { onConflict: 'equipa_id,pessoa_id', ignoreDuplicates: true },
  )
  return error ? traduzirErro(error) : null
}

export async function apagarEquipa(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }
  const resultado = await apagar({
    tabela: 'equipas',
    id,
    revalidar: ['/equipas'],
  })
  if (!resultado.ok) return resultado
  redirect(comConfirmacao('/equipas', 'apagado'))
}
