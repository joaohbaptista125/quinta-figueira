'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirPessoa } from '@/lib/sessao'
import { avisar, pessoasDaGestao } from '@/lib/notificacoes/enviar'
import { formatarEuros, formatarMes, hoje } from '@/lib/formatos'
import { ROTULOS_METODO } from '@/lib/rotulos'
import type { MetodoPagamento } from '@/lib/tipos-bd'
import { texto, textoOuNulo, valorOuNulo } from './comum'
import { traduzirErro, type ResultadoAccao } from './resultado'

/**
 * «Já paguei»: o cliente declara, a gestão confirma.
 * =============================================================================
 *
 * **Uma declaração não é um recebimento**, e isto é a regra que sustenta tudo
 * o resto. Nada aqui toca em `mensalidades_penso.estado` nem em
 * `encargos.estado`: esses continuam a derivar só dos recebimentos imputados,
 * e um recebimento continua a ser escrita de gestão. Quem paga diz o que fez;
 * quem recebe diz o que entrou.
 *
 * O que isto resolve é o meio do caminho. O extracto do banco diz «TRF 180,00
 * JOAO B» e não diz de que mês era, nem de que cavalo, nem se eram dois meses
 * de uma vez — e quem sabe isso é quem pagou.
 */

const METODOS = Object.keys(ROTULOS_METODO) as MetodoPagamento[]

/** Tudo o que mostra dívida ou dinheiro fica desactualizado com isto. */
const CAMINHOS = [
  '/pagamentos',
  '/financeiro',
  '/financeiro/por-receber',
  '/financeiro/recebimentos',
  '/financeiro/contas',
  '/',
]

// --- O lado de quem paga -----------------------------------------------------

/**
 * O cliente diz que pagou.
 *
 * Não envia `pessoa_id` nem `estado`: quem os carimba é a trigger
 * `pagamentos_declarados_carimbar`, a partir da sessão. Deixar a aplicação
 * mandar o estado era deixar quem paga dar-se por pago.
 */
export async function declararPagamento(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const mensalidadeId = textoOuNulo(dados, 'mensalidade_id')
  const encargoId = textoOuNulo(dados, 'encargo_id')

  if (!mensalidadeId && !encargoId) {
    return { ok: false, mensagem: 'Indique o que é que foi pago.' }
  }
  if (mensalidadeId && encargoId) {
    return { ok: false, mensagem: 'Um pagamento de cada vez.' }
  }

  const metodo = texto(dados, 'metodo_pagamento')
  if (!METODOS.includes(metodo as MetodoPagamento)) {
    return { ok: false, mensagem: 'Escolha como pagou.' }
  }

  const valor = valorOuNulo(dados, 'valor')
  if (valor == null || valor <= 0) {
    return { ok: false, mensagem: 'Indique quanto pagou.' }
  }

  const data = textoOuNulo(dados, 'data') ?? hoje()
  if (data > hoje()) {
    return { ok: false, mensagem: 'A data não pode ser no futuro.' }
  }

  const sessao = await exigirPessoa()
  const supabase = await criarClienteServidor()

  const { error } = await supabase.from('pagamentos_declarados').insert({
    mensalidade_id: mensalidadeId,
    encargo_id: encargoId,
    valor,
    data,
    metodo_pagamento: metodo as MetodoPagamento,
    referencia: textoOuNulo(dados, 'referencia'),
  })

  if (error) {
    // 23505 é o índice único: já existe uma declaração por confirmar para este
    // mês. Dizer «chave duplicada» a quem carregou duas vezes não ajuda.
    if (error.code === '23505') {
      return {
        ok: false,
        mensagem: 'Já tinha avisado deste pagamento — está à espera de confirmação.',
      }
    }
    return { ok: false, mensagem: traduzirErro(error) }
  }

  for (const caminho of CAMINHOS) revalidatePath(caminho)
  revalidatePath(`/pessoas/${sessao.id}/pensos`)

  await avisarDaDeclaracao({
    nome: sessao.nome,
    valor,
    metodo: metodo as MetodoPagamento,
  })

  return {
    ok: true,
    mensagem: 'Obrigado — a gestão vai confirmar e o registo aparece aqui.',
  }
}

/** Avisa a gestão de que há um pagamento por confirmar. */
async function avisarDaDeclaracao({
  nome,
  valor,
  metodo,
}: {
  nome: string
  valor: number
  metodo: MetodoPagamento
}) {
  const gestao = await pessoasDaGestao()
  await avisar(gestao, {
    titulo: `${nome.split(' ')[0]} diz que pagou`,
    texto: `${formatarEuros(valor)} por ${ROTULOS_METODO[metodo].toLowerCase()} — por confirmar`,
    caminho: '/financeiro/por-receber',
    agrupar: 'pagamentos-por-confirmar',
  })
}

/**
 * O cliente retira o que declarou, enquanto ninguém decidiu.
 *
 * Enganou-se no mês, ou afinal ainda não tinha pago. É a RLS que só deixa
 * apagar a própria e só enquanto está pendente — aqui não há verificação
 * nenhuma a fazer.
 */
export async function retirarDeclaracao(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase
    .from('pagamentos_declarados')
    .delete()
    .eq('id', id)

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  for (const caminho of CAMINHOS) revalidatePath(caminho)
  return { ok: true, mensagem: 'Retirado.' }
}

// --- O lado de quem recebe ---------------------------------------------------

/**
 * A gestão confirma, e é aí que o dinheiro nasce.
 *
 * O recebimento e o fecho da declaração acontecem na mesma transacção, dentro
 * de `confirmar_pagamento_declarado()` — sem isso, um erro entre os dois
 * passos deixava dinheiro lançado com a declaração ainda por confirmar, e a
 * gestão a confirmá-la outra vez.
 *
 * **O que fica registado é o que a gestão confirmar**, não o que o cliente
 * escreveu: valor, data e método podem ser corrigidos aqui. A conta de destino
 * é sempre escolhida aqui, porque o cliente não sabe (nem deve saber) para que
 * conta do centro o dinheiro entrou.
 */
export async function confirmarDeclaracao(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  const contaId = textoOuNulo(dados, 'conta_id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }
  if (!contaId) return { ok: false, mensagem: 'Escolha a conta de destino.' }

  const metodo = textoOuNulo(dados, 'metodo_pagamento')
  if (metodo && !METODOS.includes(metodo as MetodoPagamento)) {
    return { ok: false, mensagem: 'Método de pagamento inválido.' }
  }

  const valor = valorOuNulo(dados, 'valor')
  if (valor != null && valor <= 0) {
    return { ok: false, mensagem: 'O valor tem de ser maior do que zero.' }
  }

  const supabase = await criarClienteServidor()

  const { data: declaracao } = await supabase
    .from('pagamentos_declarados')
    .select('pessoa_id, valor, mensalidade_id, encargo_id')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.rpc('confirmar_pagamento_declarado', {
    p_declaracao: id,
    p_conta: contaId,
    p_valor: valor,
    p_data: textoOuNulo(dados, 'data'),
    p_metodo: (metodo as MetodoPagamento | null) ?? null,
  })

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  for (const caminho of CAMINHOS) revalidatePath(caminho)
  if (declaracao?.pessoa_id) {
    revalidatePath(`/pessoas/${declaracao.pessoa_id}/pensos`)
    revalidatePath(`/pessoas/${declaracao.pessoa_id}`)

    const recebido = valor ?? Number(declaracao.valor)
    await avisar([declaracao.pessoa_id], {
      titulo: 'Pagamento confirmado',
      texto: `${formatarEuros(recebido)} registado pelo centro. Obrigado.`,
      caminho: '/pagamentos',
      agrupar: 'pagamentos',
    })
  }

  return { ok: true, mensagem: 'Confirmado e registado.' }
}

/**
 * A gestão recusa: não entrou nada, ou não era isto.
 *
 * A mensalidade fica exactamente como estava — nunca chegou a mexer-se. O
 * motivo é obrigatório porque é a única coisa que o cliente vai ler, e «foi
 * recusado» sem mais nada é pior do que silêncio.
 */
export async function recusarDeclaracao(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  const motivo = textoOuNulo(dados, 'motivo')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }
  if (!motivo) {
    return {
      ok: false,
      mensagem: 'Escreva o motivo — é o que a pessoa vai ler.',
    }
  }

  const supabase = await criarClienteServidor()

  const { data: declaracao } = await supabase
    .from('pagamentos_declarados')
    .select('pessoa_id, valor, mensalidades_penso(periodo)')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase
    .from('pagamentos_declarados')
    .update({ estado: 'recusada', motivo })
    .eq('id', id)

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  for (const caminho of CAMINHOS) revalidatePath(caminho)

  if (declaracao?.pessoa_id) {
    revalidatePath(`/pessoas/${declaracao.pessoa_id}/pensos`)
    const periodo = declaracao.mensalidades_penso?.periodo
    await avisar([declaracao.pessoa_id], {
      titulo: periodo
        ? `Pagamento de ${formatarMes(periodo)} por esclarecer`
        : 'Pagamento por esclarecer',
      texto: motivo,
      caminho: '/pagamentos',
      agrupar: 'pagamentos',
    })
  }

  return { ok: true, mensagem: 'Recusado, e a pessoa foi avisada do motivo.' }
}
