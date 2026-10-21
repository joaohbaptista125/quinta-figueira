import 'server-only'

import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { supabaseUrl } from '@/lib/supabase/configuracao'
import type { BaseDados } from '@/lib/tipos-bd'

/**
 * O envio de notificações, e o único sítio da aplicação com uma chave que
 * ignora a RLS.
 * =============================================================================
 *
 * Porque é que tem de ser assim: uma notificação é mandada ao telemóvel de
 * **outra pessoa**, e isso obriga a ler a subscrição dela. O caso que importa
 * é o pior — um cliente escreve uma pergunta e a equipa tem de ser avisada: a
 * acção corre com a identidade do cliente, e um cliente não pode ler as
 * subscrições da equipa. Dar-lhe essa leitura era dar-lhe as chaves para
 * mandar notificações aos telemóveis do centro.
 *
 * **As regras deste ficheiro, que não são sugestões:**
 *
 * 1. É o único que lê `SUPABASE_SERVICE_ROLE_KEY`. Se alguma vez vires essa
 *    variável noutro sítio, está errado.
 * 2. Não exporta o cliente privilegiado. Só saem daqui funções que mandam
 *    notificações — nunca uma porta para a base de dados.
 * 3. Não recebe de fora o nome de uma tabela, nem um filtro, nem uma consulta.
 *    Só ids de pessoas e o texto a mandar.
 * 4. Só toca em `subscricoes_push`, e só para ler e para apagar o que morreu.
 *
 * `import 'server-only'` faz a compilação falhar se alguém importar isto num
 * componente de cliente — é a diferença entre uma regra escrita e uma regra
 * que se faz cumprir sozinha.
 */

const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const vapidPublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
const vapidPrivada = process.env.VAPID_PRIVATE_KEY?.trim()
const contactoVapid = process.env.VAPID_CONTACTO?.trim() || 'mailto:geral@quintadafigueira.pt'

/** Sem configuração não há notificações — e a aplicação funciona na mesma. */
export const notificacoesConfiguradas = Boolean(
  chaveServico && vapidPublica && vapidPrivada,
)

/**
 * O que falta configurar, pelo nome da variável.
 *
 * Existe para o teste de `/conta` poder dizer a verdade a quem está a montar
 * isto. **Devolve nomes, nunca valores** — e é o mais perto que este ficheiro
 * chega de deixar alguém ver o que lá está dentro.
 */
export function faltaConfigurar(): string[] {
  const falta: string[] = []
  if (!vapidPublica) falta.push('NEXT_PUBLIC_VAPID_PUBLIC_KEY')
  if (!vapidPrivada) falta.push('VAPID_PRIVATE_KEY')
  if (!chaveServico) falta.push('SUPABASE_SERVICE_ROLE_KEY')
  return falta
}

export type AvisoPush = {
  titulo: string
  texto: string
  /** Caminho interno a abrir quando se toca na notificação. */
  caminho: string
  /**
   * Junta notificações do mesmo assunto numa só no telemóvel. Sem isto, dez
   * notas no mesmo cavalo são dez notificações empilhadas.
   */
  agrupar?: string
}

/**
 * Manda um aviso aos telemóveis destas pessoas.
 *
 * Nunca lança: uma notificação que não sai não pode fazer falhar o que a
 * originou. Quem escreveu uma nota escreveu-a, mesmo que o aviso se perca —
 * e o contador no painel continua lá como rede.
 */
export async function avisar(
  pessoaIds: string[],
  aviso: AvisoPush,
): Promise<void> {
  const destinos = [...new Set(pessoaIds.filter(Boolean))]
  if (destinos.length === 0 || !notificacoesConfiguradas) return

  try {
    webpush.setVapidDetails(contactoVapid, vapidPublica!, vapidPrivada!)

    const supabase = createClient<BaseDados>(supabaseUrl, chaveServico!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: subscricoes } = await supabase
      .from('subscricoes_push')
      .select('id, endpoint, p256dh, auth')
      .in('pessoa_id', destinos)

    if (!subscricoes || subscricoes.length === 0) return

    const corpo = JSON.stringify({
      titulo: aviso.titulo,
      texto: aviso.texto,
      caminho: aviso.caminho,
      agrupar: aviso.agrupar ?? aviso.caminho,
    })

    const mortas: string[] = []

    await Promise.all(
      subscricoes.map(async (subscricao) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscricao.endpoint,
              keys: { p256dh: subscricao.p256dh, auth: subscricao.auth },
            },
            corpo,
            { TTL: 60 * 60 * 24 },
          )
        } catch (erro) {
          // 404 e 410 são o serviço de push a dizer que aquela morada já não
          // existe: a pessoa desinstalou, limpou os dados, ou o iPhone
          // decidiu. Guardar uma morada morta é mandar para o vazio todos os
          // dias; qualquer outro erro é passageiro e não condena nada.
          const estado = (erro as { statusCode?: number }).statusCode
          if (estado === 404 || estado === 410) mortas.push(subscricao.id)
        }
      }),
    )

    if (mortas.length > 0) {
      await supabase.from('subscricoes_push').delete().in('id', mortas)
    }
  } catch {
    // Chave mal configurada, rede em baixo, o que for. Silêncio de propósito:
    // ver a regra em cima.
  }
}

/**
 * Quem é da equipa, para os avisos que vão «para o centro».
 *
 * Também precisa da chave privilegiada: quem escreve uma pergunta é um
 * cliente, e um cliente só vê a própria ficha em `pessoas`.
 */
export async function pessoasDaEquipa(): Promise<string[]> {
  if (!notificacoesConfiguradas) return []

  try {
    const supabase = createClient<BaseDados>(supabaseUrl, chaveServico!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data } = await supabase
      .from('pessoas')
      .select('id')
      .eq('activo', true)
      .in('perfil', ['admin', 'gestor', 'instrutor', 'tratador'])

    return (data ?? []).map((pessoa) => pessoa.id)
  } catch {
    return []
  }
}

/**
 * O mesmo envio, mas a contar o que correu bem e o que correu mal.
 *
 * Serve só o teste que a pessoa faz a si própria em `/conta`. O envio normal
 * é mudo de propósito — uma notificação que não sai não pode fazer falhar o
 * que a originou —, e isso é óptimo em produção e péssimo quando se está a
 * montar: ficava-se sem saber se o silêncio era sucesso ou avaria.
 *
 * Só se chama com a própria pessoa como destino, por isso não há aqui nada a
 * revelar a ninguém sobre os aparelhos de outros.
 */
export async function avisarComRelatorio(
  pessoaId: string,
  aviso: AvisoPush,
): Promise<{ enviados: number; falhados: number; motivo: string | null }> {
  const falta = faltaConfigurar()
  if (falta.length > 0) {
    return {
      enviados: 0,
      falhados: 0,
      motivo: `Falta configurar no ambiente: ${falta.join(', ')}.`,
    }
  }

  try {
    webpush.setVapidDetails(contactoVapid, vapidPublica!, vapidPrivada!)

    const supabase = createClient<BaseDados>(supabaseUrl, chaveServico!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: subscricoes, error } = await supabase
      .from('subscricoes_push')
      .select('id, endpoint, p256dh, auth')
      .eq('pessoa_id', pessoaId)

    if (error) {
      // O caso mais provável aqui é a chave de serviço estar errada: com ela
      // mal copiada, a leitura devolve erro em vez de linhas.
      return {
        enviados: 0,
        falhados: 0,
        motivo: `A base recusou a leitura das subscrições (${error.message}). Confirme a SUPABASE_SERVICE_ROLE_KEY.`,
      }
    }

    if (!subscricoes || subscricoes.length === 0) {
      return {
        enviados: 0,
        falhados: 0,
        motivo: 'Não há nenhum aparelho ligado para si. Ligue as notificações neste aparelho primeiro.',
      }
    }

    const corpo = JSON.stringify({
      titulo: aviso.titulo,
      texto: aviso.texto,
      caminho: aviso.caminho,
      agrupar: aviso.agrupar ?? aviso.caminho,
    })

    let enviados = 0
    let falhados = 0
    let primeiroErro: string | null = null

    await Promise.all(
      subscricoes.map(async (subscricao) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscricao.endpoint,
              keys: { p256dh: subscricao.p256dh, auth: subscricao.auth },
            },
            corpo,
            { TTL: 60 },
          )
          enviados += 1
        } catch (erro) {
          falhados += 1
          const estado = (erro as { statusCode?: number }).statusCode
          const texto = (erro as { body?: string; message?: string }).body
            ?? (erro as { message?: string }).message
            ?? 'sem detalhe'
          primeiroErro ??= `${estado ?? 'erro'}: ${String(texto).slice(0, 200)}`
        }
      }),
    )

    return {
      enviados,
      falhados,
      motivo: falhados > 0 ? primeiroErro : null,
    }
  } catch (erro) {
    // Chave VAPID mal formada cai aqui, e é o engano mais fácil de cometer:
    // trocar a pública pela privada, ou copiar com um espaço no fim.
    return {
      enviados: 0,
      falhados: 0,
      motivo: `Não foi possível preparar o envio: ${(erro as Error).message}. Confirme as chaves VAPID — a pública e a privada não podem estar trocadas.`,
    }
  }
}
