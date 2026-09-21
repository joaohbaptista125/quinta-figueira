'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { formatarEuros, hoje, primeiroDiaDoMes } from '@/lib/formatos'
import { ROTULOS_METODO, ROTULOS_TIPO_RECEBIMENTO } from '@/lib/rotulos'
import type { MetodoPagamento, TipoRecebimento } from '@/lib/tipos-bd'
import {
  apagar,
  comConfirmacao,
  booleano,
  gravar,
  listaTexto,
  querContinuar,
  texto,
  textoOuNulo,
  valorOuNulo,
} from './comum'
import { traduzirErro, type ResultadoAccao } from './resultado'

const METODOS = Object.keys(ROTULOS_METODO) as MetodoPagamento[]
const TIPOS_RECEBIMENTO = Object.keys(
  ROTULOS_TIPO_RECEBIMENTO,
) as TipoRecebimento[]

// --- Despesas ---------------------------------------------------------------

export async function guardarDespesa(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = textoOuNulo(dados, 'id')
  const descricao = texto(dados, 'descricao')
  const categoriaId = textoOuNulo(dados, 'categoria_id')
  const contaId = textoOuNulo(dados, 'conta_id')
  const valorTotal = valorOuNulo(dados, 'valor_total')
  const metodo = texto(dados, 'metodo_pagamento')

  if (!descricao) return { ok: false, mensagem: 'Escreva uma descrição.' }
  if (!categoriaId) return { ok: false, mensagem: 'Escolha a categoria.' }
  if (!contaId) return { ok: false, mensagem: 'Escolha a conta de origem.' }
  if (valorTotal == null || valorTotal < 0) {
    return { ok: false, mensagem: 'Indique um valor válido.' }
  }
  if (!METODOS.includes(metodo as MetodoPagamento)) {
    return { ok: false, mensagem: 'Escolha o método de pagamento.' }
  }

  // Tal como as fotos, a fatura já subiu do browser directamente para o
  // Storage; aqui chega só o caminho.
  const anexoPath = textoOuNulo(dados, 'anexo_path')

  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const resultado = await gravar({
    tabela: 'despesas',
    id,
    valores: {
      data: textoOuNulo(dados, 'data'),
      categoria_id: categoriaId,
      fornecedor_id: textoOuNulo(dados, 'fornecedor_id'),
      descricao,
      valor_total: valorTotal,
      taxa_iva: valorOuNulo(dados, 'taxa_iva') ?? 0,
      metodo_pagamento: metodo,
      conta_id: contaId,
      paga: booleano(dados, 'paga'),
      cavalo_id: textoOuNulo(dados, 'cavalo_id'),
      notas: textoOuNulo(dados, 'notas'),
      ...(anexoPath ? { anexo_path: anexoPath } : {}),
      ...(id ? {} : { criado_por: user?.id ?? null }),
    },
    revalidar: ['/financeiro/despesas', '/financeiro/contas', '/'],
    mensagemCriado: 'Despesa registada. Pode lançar já a seguinte.',
  })

  if (!resultado.ok) return resultado
  if (querContinuar(dados)) return resultado
  redirect(comConfirmacao('/financeiro/despesas', id ? 'guardado' : 'criado'))
}

export async function apagarDespesa(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }
  const resultado = await apagar({
    tabela: 'despesas',
    id,
    revalidar: ['/financeiro/despesas', '/financeiro/contas', '/'],
  })
  if (!resultado.ok) return resultado
  redirect(comConfirmacao('/financeiro/despesas', 'apagado'))
}

/** Marca uma despesa por pagar como paga, a partir da listagem. */
export async function marcarDespesaPaga(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase
    .from('despesas')
    .update({ paga: true })
    .eq('id', id)

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  revalidatePath('/financeiro/despesas')
  revalidatePath('/financeiro/contas')
  revalidatePath('/')
  return { ok: true, mensagem: 'Despesa marcada como paga.' }
}

// --- Recebimentos -----------------------------------------------------------

export async function guardarRecebimento(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = textoOuNulo(dados, 'id')
  const pessoaId = textoOuNulo(dados, 'pessoa_id')
  const contaId = textoOuNulo(dados, 'conta_id')
  const valor = valorOuNulo(dados, 'valor')
  const metodo = texto(dados, 'metodo_pagamento')
  const tipo = texto(dados, 'tipo')

  if (!pessoaId) return { ok: false, mensagem: 'Escolha a pessoa.' }
  if (!contaId) return { ok: false, mensagem: 'Escolha a conta de destino.' }
  if (valor == null || valor <= 0) {
    return { ok: false, mensagem: 'Indique um valor maior do que zero.' }
  }
  if (!METODOS.includes(metodo as MetodoPagamento)) {
    return { ok: false, mensagem: 'Escolha o método de pagamento.' }
  }
  if (!TIPOS_RECEBIMENTO.includes(tipo as TipoRecebimento)) {
    return { ok: false, mensagem: 'Indique a que se refere o recebimento.' }
  }

  const periodoBruto = textoOuNulo(dados, 'periodo')
  const periodo = periodoBruto ? primeiroDiaDoMes(`${periodoBruto}-01`) : null

  // A mensalidade só faz sentido em recebimentos de penso (há um CHECK na base).
  const mensalidadeId =
    tipo === 'penso' ? textoOuNulo(dados, 'mensalidade_id') : null

  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const resultado = await gravar({
    tabela: 'recebimentos',
    id,
    valores: {
      data: textoOuNulo(dados, 'data'),
      pessoa_id: pessoaId,
      valor,
      metodo_pagamento: metodo,
      conta_id: contaId,
      tipo,
      mensalidade_id: mensalidadeId,
      periodo,
      descricao: textoOuNulo(dados, 'descricao'),
      notas: textoOuNulo(dados, 'notas'),
      // Referência de documento emitido em software certificado pela AT.
      // A aplicação não emite documentos fiscais; isto é só o número dele.
      documento_fiscal_ref: textoOuNulo(dados, 'documento_fiscal_ref'),
      ...(id ? {} : { criado_por: user?.id ?? null }),
    },
    revalidar: [
      '/financeiro/recebimentos',
      '/financeiro/pensos',
      '/financeiro/contas',
      '/',
    ],
    mensagemCriado: 'Recebimento registado. Pode lançar já o seguinte.',
  })

  if (!resultado.ok) return resultado
  if (querContinuar(dados)) return resultado
  redirect(comConfirmacao('/financeiro/recebimentos', id ? 'guardado' : 'criado'))
}

export async function apagarRecebimento(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }
  const resultado = await apagar({
    tabela: 'recebimentos',
    id,
    revalidar: [
      '/financeiro/recebimentos',
      '/financeiro/pensos',
      '/financeiro/contas',
      '/',
    ],
  })
  if (!resultado.ok) return resultado
  redirect(comConfirmacao('/financeiro/recebimentos', 'apagado'))
}

// --- Mensalidades de penso --------------------------------------------------

/** Cria as mensalidades em falta do mês, a partir dos contratos em vigor. */
export async function gerarMensalidades(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const periodo = textoOuNulo(dados, 'periodo')
  if (!periodo) return { ok: false, mensagem: 'Indique o mês.' }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('gerar_mensalidades', {
    p_periodo: `${periodo}-01`,
  })

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  revalidatePath('/financeiro/pensos')
  revalidatePath('/')

  const criadas = typeof data === 'number' ? data : 0
  return {
    ok: true,
    mensagem:
      criadas === 0
        ? 'Não havia mensalidades em falta para este mês.'
        : `${criadas} mensalidade(s) criada(s).`,
  }
}

export async function anularMensalidade(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase
    .from('mensalidades_penso')
    .update({ estado: 'anulada' })
    .eq('id', id)

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  revalidatePath('/financeiro/pensos')
  revalidatePath('/')
  return { ok: true, mensagem: 'Mensalidade anulada.' }
}

/**
 * Recebe uma ou várias mensalidades de penso de uma só vez.
 *
 * É o caminho curto da cobrança: da conta-corrente do cliente, escolher o
 * método e confirmar. O formulário completo de recebimento continua a existir
 * para os casos fora do normal (imputar a outra pessoa, número de documento
 * fiscal, notas) — este resolve os noventa por cento restantes em três toques.
 *
 * Uma mensalidade = um recebimento, mesmo quando se recebem três meses na
 * mesma transferência. É o que mantém `mensalidade_id` a ligar cada euro ao
 * mês a que respeita, e é isso que faz a trigger acertar o estado de cada um.
 */
export async function receberPensos(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const ids = listaTexto(dados, 'mensalidades')
  if (ids.length === 0) {
    return { ok: false, mensagem: 'Escolha pelo menos uma mensalidade.' }
  }

  const metodo = texto(dados, 'metodo_pagamento')
  if (!METODOS.includes(metodo as MetodoPagamento)) {
    return { ok: false, mensagem: 'Escolha o método de pagamento.' }
  }

  const contaId = textoOuNulo(dados, 'conta_id')
  if (!contaId) return { ok: false, mensagem: 'Escolha a conta de destino.' }

  const data = textoOuNulo(dados, 'data') ?? hoje()

  const supabase = await criarClienteServidor()

  // O que falta de cada mensalidade vem da base, não do formulário: entre
  // abrir a página e carregar no botão pode ter entrado outro pagamento.
  const { data: linhas, error: erroLeitura } = await supabase
    .from('v_pensos_por_receber')
    .select('mensalidade_id, periodo, cliente_id, valor_em_falta')
    .in('mensalidade_id', ids)

  if (erroLeitura) return { ok: false, mensagem: traduzirErro(erroLeitura) }
  if (!linhas || linhas.length === 0) {
    return { ok: false, mensagem: 'Mensalidade não encontrada.' }
  }

  // Com uma só mensalidade aceita-se um valor diferente do que falta, para
  // permitir pagamentos parciais. Com várias, cada uma é recebida por inteiro.
  const valorEscrito = ids.length === 1 ? valorOuNulo(dados, 'valor') : null
  if (ids.length === 1 && valorEscrito != null && valorEscrito <= 0) {
    return { ok: false, mensagem: 'Indique um valor maior do que zero.' }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const novos = linhas
    .map((linha) => ({
      data,
      pessoa_id: linha.cliente_id,
      valor: valorEscrito ?? Number(linha.valor_em_falta),
      metodo_pagamento: metodo as MetodoPagamento,
      conta_id: contaId,
      tipo: 'penso' as TipoRecebimento,
      mensalidade_id: linha.mensalidade_id,
      periodo: linha.periodo,
      criado_por: user?.id ?? null,
    }))
    .filter((recebimento) => recebimento.valor > 0)

  if (novos.length === 0) {
    return { ok: false, mensagem: 'Estas mensalidades já estão pagas.' }
  }

  const { error } = await supabase.from('recebimentos').insert(novos)
  if (error) return { ok: false, mensagem: traduzirErro(error) }

  const pessoaId = linhas[0].cliente_id
  revalidatePath(`/pessoas/${pessoaId}/pensos`)
  revalidatePath(`/pessoas/${pessoaId}`)
  revalidatePath('/financeiro/pensos')
  revalidatePath('/financeiro/recebimentos')
  revalidatePath('/financeiro/contas')
  revalidatePath('/')

  const total = novos.reduce((soma, recebimento) => soma + recebimento.valor, 0)
  return {
    ok: true,
    mensagem:
      novos.length === 1
        ? `Recebido ${formatarEuros(total)} por ${ROTULOS_METODO[metodo as MetodoPagamento]}.`
        : `Recebidas ${novos.length} mensalidades, ${formatarEuros(total)} por ${ROTULOS_METODO[metodo as MetodoPagamento]}.`,
  }
}
