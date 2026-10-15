'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/servidor'
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

  const supabase = await criarClienteServidor()
  const { error } = await supabase
    .from('notas_cavalo')
    .insert({ cavalo_id: cavaloId, texto: conteudo })

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  revalidatePath(`/cavalos/${cavaloId}`)
  revalidatePath('/cavalos')
  revalidatePath('/')

  return { ok: true, mensagem: 'Escrito.' }
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
