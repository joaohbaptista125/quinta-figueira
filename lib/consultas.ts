import type { SupabaseClient } from '@supabase/supabase-js'
import type { BaseDados } from '@/lib/tipos-bd'

type Cliente = SupabaseClient<BaseDados>

/** Pessoas activas, para os selectores dos formulários. */
export async function pessoasActivas(supabase: Cliente) {
  const { data } = await supabase
    .from('pessoas')
    .select('id, nome')
    .eq('activo', true)
    .order('nome')
  return data ?? []
}

/**
 * Cavalos activos **e já aprovados**, para os selectores dos formulários.
 *
 * Uma ficha que o cliente inscreveu e que ninguém confirmou ainda não é um
 * cavalo do centro: oferecê-la para um contrato de penso ou para uma
 * convocatória era dar-lhe existência antes da decisão.
 */
export async function cavalosActivos(supabase: Cliente) {
  const { data } = await supabase
    .from('cavalos')
    .select('id, nome')
    .eq('activo', true)
    .not('aprovado_em', 'is', null)
    .order('nome')
  return data ?? []
}

/** Contas activas, para escolher origem/destino do dinheiro. */
export async function contasActivas(supabase: Cliente) {
  const { data } = await supabase
    .from('contas')
    .select('id, nome, tipo')
    .eq('activa', true)
    .order('nome')
  return data ?? []
}

/**
 * As raças e as pelagens que o formulário do cavalo oferece.
 *
 * Vêm as duas na mesma ida à base — são catorze linhas e não vale a pena
 * gastar duas viagens ao Supabase por causa delas.
 */
export async function opcoesDeCavalo(supabase: Cliente) {
  const { data } = await supabase
    .from('opcoes_cavalo')
    .select('tipo, valor')
    .eq('activa', true)
    .order('ordem')
    .order('valor')

  const de = (tipo: 'raca' | 'pelagem') =>
    (data ?? []).filter((opcao) => opcao.tipo === tipo).map((opcao) => opcao.valor)

  return { racas: de('raca'), pelagens: de('pelagem') }
}

/**
 * Os nomes que quem está a ver pode ver — pessoas e cavalos, em dois mapas.
 *
 * **Isto existe porque a RLS decide linhas e não colunas.** `pessoas_ler` é
 * `e_equipa() or id = pessoa_actual_id()` e `cavalos_ler` é `e_equipa()` ou
 * ser dono: para um cliente, **nada do que é dos outros tem nome**. A lista de
 * jogadores da equipa vinha em branco, o chat sem autores, a convocatória sem
 * colegas e o quadro do dia sem os pares aluno↔cavalo. Abrir `pessoas` à
 * equipa resolvia tudo e dava-lhe a ficha inteira dos colegas.
 *
 * `nomes_visiveis()` é SECURITY DEFINER e devolve **só id e nome** de quem
 * partilha comigo uma equipa ou um evento. Uma chamada por página, seja qual
 * for o número de equipas ou de eventos no ecrã — foi por isso que substituiu
 * as duas funções parametrizadas que existiram antes dela.
 *
 * **Não é opcional nas páginas que mostram nomes de outras pessoas**: sem
 * isto, o ecrã fica certo para a gestão e em branco para quem o usa.
 */
export async function nomesVisiveis(supabase: Cliente) {
  const { data } = await supabase.rpc('nomes_visiveis')

  const pessoas = new Map<string, string>()
  const cavalos = new Map<string, string>()

  for (const linha of data ?? []) {
    if (linha.tipo === 'cavalo') cavalos.set(linha.id, linha.nome)
    else pessoas.set(linha.id, linha.nome)
  }

  return { pessoas, cavalos }
}
