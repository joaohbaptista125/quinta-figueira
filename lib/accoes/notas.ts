'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirPessoa } from '@/lib/sessao'
import { eEquipa } from '@/lib/permissoes'
import { avisar, pessoasDaEquipa } from '@/lib/notificacoes/enviar'
import { texto } from './comum'
import { traduzirErro, type ResultadoAccao } from './resultado'

/**
 * Escreve uma nota na conversa de um cavalo.
 *
 * Não envia autor nem lado: quem carimba isso é a trigger
 * `notas_cavalo_carimbar_autor`, a partir da sessão. Deixar a aplicação dizer
 * quem escreveu era deixá-la escrever em nome de outro.
 */
export async function escreverNota(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const cavaloId = texto(dados, 'cavalo_id')
  const conteudo = texto(dados, 'texto')

  if (!cavaloId) return { ok: false, mensagem: 'Cavalo em falta.' }
  if (!conteudo) return { ok: false, mensagem: 'Escreva alguma coisa.' }
  if (conteudo.length > 2000) {
    return { ok: false, mensagem: 'A nota é demasiado longa (máximo 2000 caracteres).' }
  }

  const sessao = await exigirPessoa()
  const supabase = await criarClienteServidor()
  const { error } = await supabase
    .from('notas_cavalo')
    .insert({ cavalo_id: cavaloId, texto: conteudo })

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  revalidatePath(`/cavalos/${cavaloId}`)
  revalidatePath('/cavalos')
  revalidatePath('/')

  await avisarDaNota({
    cavaloId,
    conteudo,
    autorNome: sessao.nome,
    deEquipa: eEquipa(sessao.perfil),
  })

  return { ok: true, mensagem: 'Escrito.' }
}

/**
 * Avisa o outro lado da conversa.
 *
 * Quem escreve é que decide para onde vai o aviso: uma pergunta do dono vai
 * para a equipa toda, uma resposta da equipa vai para o dono. O aviso nunca
 * volta para quem escreveu.
 *
 * Isto corre **depois** de a nota estar gravada e de propósito não trava
 * nada: uma notificação que não sai não pode fazer falhar o que a originou.
 */
async function avisarDaNota({
  cavaloId,
  conteudo,
  autorNome,
  deEquipa,
}: {
  cavaloId: string
  conteudo: string
  autorNome: string
  deEquipa: boolean
}) {
  const supabase = await criarClienteServidor()
  const { data: cavalo } = await supabase
    .from('cavalos')
    .select('nome, proprietario_id')
    .eq('id', cavaloId)
    .maybeSingle()

  if (!cavalo) return

  const primeiroNome = autorNome.split(' ')[0]
  const caminho = `/cavalos/${cavaloId}`

  if (deEquipa) {
    if (!cavalo.proprietario_id) return
    await avisar([cavalo.proprietario_id], {
      titulo: `Resposta sobre o ${cavalo.nome}`,
      texto: conteudo,
      caminho,
      agrupar: `nota-${cavaloId}`,
    })
    return
  }

  const equipa = await pessoasDaEquipa()
  await avisar(equipa, {
    titulo: `${primeiroNome} perguntou sobre o ${cavalo.nome}`,
    texto: conteudo,
    caminho,
    agrupar: `nota-${cavaloId}`,
  })
}

/**
 * Apaga uma nota. Só a gestão, e só para o caso de alguém escrever o que não
 * devia — uma conversa reescrita depois do facto não serve de caderno.
 */
export async function apagarNota(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  const cavaloId = texto(dados, 'cavalo_id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('notas_cavalo').delete().eq('id', id)

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  revalidatePath(`/cavalos/${cavaloId}`)
  revalidatePath('/cavalos')
  revalidatePath('/')

  return { ok: true, mensagem: 'Nota apagada.' }
}
