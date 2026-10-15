'use server'

import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirPessoa } from '@/lib/sessao'
import { texto, textoOuNulo } from './comum'
import { traduzirErro, type ResultadoAccao } from './resultado'

/**
 * Guarda a morada do telemóvel que acabou de autorizar ser avisado.
 *
 * `pessoa_id` sai da sessão e nunca do formulário: a RLS também o exige, mas
 * mandá-lo do browser era convidar a enganá-la.
 *
 * O mesmo browser a autorizar outra vez devolve a mesma morada — daí o
 * `upsert` por `endpoint`. Sem isso, cada entrada na aplicação deixava uma
 * subscrição repetida e a pessoa recebia a mesma notificação quatro vezes.
 */
export async function guardarSubscricao(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const sessao = await exigirPessoa()

  const endpoint = texto(dados, 'endpoint')
  const p256dh = texto(dados, 'p256dh')
  const auth = texto(dados, 'auth')

  if (!endpoint || !p256dh || !auth) {
    return { ok: false, mensagem: 'O browser não devolveu uma subscrição válida.' }
  }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('subscricoes_push').upsert(
    {
      pessoa_id: sessao.id,
      endpoint,
      p256dh,
      auth,
      agente: textoOuNulo(dados, 'agente'),
    },
    { onConflict: 'endpoint' },
  )

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  return { ok: true, mensagem: 'Este telemóvel passa a ser avisado.' }
}

/** Deixa de avisar este telemóvel. A morada é apagada, não desligada. */
export async function removerSubscricao(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  await exigirPessoa()

  const endpoint = texto(dados, 'endpoint')
  if (!endpoint) return { ok: false, mensagem: 'Subscrição não encontrada.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase
    .from('subscricoes_push')
    .delete()
    .eq('endpoint', endpoint)

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  return { ok: true, mensagem: 'Este telemóvel deixa de ser avisado.' }
}
