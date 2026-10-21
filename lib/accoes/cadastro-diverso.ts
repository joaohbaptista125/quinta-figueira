'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import {
  apagar,
  comConfirmacao,
  booleano,
  gravar,
  inteiroOuNulo,
  querContinuar,
  texto,
  textoOuNulo,
  valorOuNulo,
} from './comum'
import { traduzirErro, type ResultadoAccao } from './resultado'

// --- Boxes ------------------------------------------------------------------

export async function guardarBox(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = textoOuNulo(dados, 'id')
  const identificacao = texto(dados, 'identificacao')
  if (!identificacao) {
    return { ok: false, mensagem: 'A identificação da box é obrigatória.' }
  }

  const resultado = await gravar({
    tabela: 'boxes',
    id,
    valores: {
      identificacao,
      zona: textoOuNulo(dados, 'zona'),
      cavalo_id: textoOuNulo(dados, 'cavalo_id'),
      activa: booleano(dados, 'activa'),
      notas: textoOuNulo(dados, 'notas'),
    },
    revalidar: ['/boxes', '/cavalos'],
    mensagemCriado: `Box ${identificacao} criada. Pode continuar a introduzir boxes.`,
  })

  if (!resultado.ok) return resultado
  if (querContinuar(dados)) return resultado
  redirect(comConfirmacao('/boxes', id ? 'guardado' : 'criado'))
}

export async function apagarBox(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }
  const resultado = await apagar({ tabela: 'boxes', id, revalidar: ['/boxes'] })
  if (!resultado.ok) return resultado
  redirect(comConfirmacao('/boxes', 'apagado'))
}

// --- Contratos de penso -----------------------------------------------------

export async function guardarContrato(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = textoOuNulo(dados, 'id')
  const cavaloId = textoOuNulo(dados, 'cavalo_id')
  const clienteId = textoOuNulo(dados, 'cliente_id')
  const valorMensal = valorOuNulo(dados, 'valor_mensal')
  const dataInicio = textoOuNulo(dados, 'data_inicio')

  if (!cavaloId) return { ok: false, mensagem: 'Escolha o cavalo.' }
  if (!clienteId) return { ok: false, mensagem: 'Escolha o cliente.' }
  if (valorMensal == null || valorMensal < 0) {
    return { ok: false, mensagem: 'Indique um valor mensal válido.' }
  }
  if (!dataInicio) return { ok: false, mensagem: 'Indique a data de início.' }

  const diaVencimento = inteiroOuNulo(dados, 'dia_vencimento') ?? 1
  if (diaVencimento < 1 || diaVencimento > 28) {
    return {
      ok: false,
      mensagem: 'O dia de vencimento tem de estar entre 1 e 28.',
    }
  }

  const resultado = await gravar({
    tabela: 'contratos_penso',
    id,
    valores: {
      cavalo_id: cavaloId,
      cliente_id: clienteId,
      valor_mensal: valorMensal,
      dia_vencimento: diaVencimento,
      data_inicio: dataInicio,
      data_fim: textoOuNulo(dados, 'data_fim'),
      notas: textoOuNulo(dados, 'notas'),
    },
    revalidar: ['/contratos', '/financeiro/por-receber', '/financeiro'],
    mensagemCriado: 'Contrato criado. Pode continuar a introduzir contratos.',
  })

  if (!resultado.ok) return resultado
  if (querContinuar(dados)) return resultado
  redirect(comConfirmacao('/contratos', id ? 'guardado' : 'criado'))
}

/**
 * Apagar um contrato é mais perigoso do que parece, e a base não trava.
 *
 * `mensalidades_penso.contrato_id` é `on delete cascade` e
 * `recebimentos.mensalidade_id` é `on delete set null`: apagar o contrato
 * leva consigo todas as mensalidades e **desliga os pagamentos do mês que
 * pagaram**. O dinheiro fica lá, mas deixa de se saber ao que respeitava, e
 * isso não se desfaz. O Postgres aceita sem dizer nada — por isso o travão é
 * aqui.
 *
 * Um contrato que já teve dinheiro em cima termina-se (`data_fim`); apagar é
 * para o contrato que nasceu por engano e nunca chegou a cobrar nada.
 */
export async function apagarContrato(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }

  const supabase = await criarClienteServidor()
  const { data: mensalidades, error: erroLeitura } = await supabase
    .from('mensalidades_penso')
    .select('id')
    .eq('contrato_id', id)

  if (erroLeitura) return { ok: false, mensagem: traduzirErro(erroLeitura) }

  const ids = (mensalidades ?? []).map((linha) => linha.id)

  if (ids.length > 0) {
    const { count: pagamentos } = await supabase
      .from('recebimentos')
      .select('id', { count: 'exact', head: true })
      .in('mensalidade_id', ids)

    if (pagamentos && pagamentos > 0) {
      return {
        ok: false,
        mensagem: `Não dá para apagar: este contrato já tem ${
          pagamentos === 1 ? '1 pagamento imputado' : `${pagamentos} pagamentos imputados`
        }. Apagá-lo desligaria esse dinheiro do mês que pagou. Termine o contrato — deixa de gerar mensalidades e o histórico fica de pé.`,
      }
    }
  }

  const resultado = await apagar({
    tabela: 'contratos_penso',
    id,
    revalidar: ['/contratos', '/financeiro/por-receber', '/financeiro'],
  })
  if (!resultado.ok) return resultado
  redirect(comConfirmacao('/contratos', 'apagado'))
}

/**
 * Termina um contrato de penso, ou volta a pô-lo em vigor.
 *
 * É o equivalente ao «desactivar» das outras fichas: um contrato não tem
 * estado activo, tem `data_fim`. A partir daí deixa de aparecer como em vigor
 * e `gerar_mensalidades` deixa de o cobrar — as mensalidades que já existem
 * ficam onde estão, porque respeitam a meses que passaram de verdade.
 */
export async function alternarVigorContrato(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }

  const supabase = await criarClienteServidor()
  const { data: contrato, error: erroLeitura } = await supabase
    .from('contratos_penso')
    .select('data_inicio, data_fim, cavalos(nome)')
    .eq('id', id)
    .maybeSingle()

  if (erroLeitura) return { ok: false, mensagem: traduzirErro(erroLeitura) }
  if (!contrato) return { ok: false, mensagem: 'Contrato não encontrado.' }

  const reabrir = contrato.data_fim !== null
  // Datas do Postgres são texto AAAA-MM-DD e comparam-se como texto. Um
  // contrato que começa amanhã termina na data de início, não ontem.
  const hoje = new Date().toISOString().slice(0, 10)
  const fim = hoje < contrato.data_inicio ? contrato.data_inicio : hoje

  const { error } = await supabase
    .from('contratos_penso')
    .update({ data_fim: reabrir ? null : fim })
    .eq('id', id)

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  revalidatePath('/contratos')
  revalidatePath(`/contratos/${id}`)
  revalidatePath('/financeiro/por-receber')
  revalidatePath('/financeiro')

  const nome = contrato.cavalos?.nome ?? 'O contrato'

  return {
    ok: true,
    mensagem: reabrir
      ? `Contrato de ${nome} outra vez em vigor.`
      : `Contrato de ${nome} terminado. Deixa de gerar mensalidades; as que já existem ficam.`,
  }
}

// --- Contas -----------------------------------------------------------------

export async function guardarConta(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = textoOuNulo(dados, 'id')
  const nome = texto(dados, 'nome')
  const tipo = texto(dados, 'tipo')

  if (!nome) return { ok: false, mensagem: 'O nome da conta é obrigatório.' }
  if (tipo !== 'caixa' && tipo !== 'banco') {
    return { ok: false, mensagem: 'Escolha o tipo de conta.' }
  }

  const resultado = await gravar({
    tabela: 'contas',
    id,
    valores: {
      nome,
      tipo,
      iban: tipo === 'banco' ? textoOuNulo(dados, 'iban') : null,
      saldo_inicial: valorOuNulo(dados, 'saldo_inicial') ?? 0,
      activa: booleano(dados, 'activa'),
      notas: textoOuNulo(dados, 'notas'),
    },
    revalidar: ['/financeiro/contas', '/'],
    mensagemCriado: `Conta ${nome} criada.`,
  })

  if (!resultado.ok) return resultado
  if (querContinuar(dados)) return resultado
  redirect(comConfirmacao('/financeiro/contas', id ? 'guardado' : 'criado'))
}

export async function apagarConta(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }
  const resultado = await apagar({
    tabela: 'contas',
    id,
    revalidar: ['/financeiro/contas', '/'],
  })
  if (!resultado.ok) {
    return {
      ok: false,
      mensagem:
        'Não é possível apagar: a conta tem movimentos. Marque-a como inactiva.',
    }
  }
  redirect(comConfirmacao('/financeiro/contas', 'apagado'))
}

// --- Fornecedores -----------------------------------------------------------

export async function guardarFornecedor(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = textoOuNulo(dados, 'id')
  const nome = texto(dados, 'nome')
  if (!nome) return { ok: false, mensagem: 'O nome é obrigatório.' }

  const nif = textoOuNulo(dados, 'nif')
  if (nif && !/^\d{9}$/.test(nif)) {
    return { ok: false, mensagem: 'O NIF tem de ter exactamente 9 dígitos.' }
  }

  const resultado = await gravar({
    tabela: 'fornecedores',
    id,
    valores: {
      nome,
      nif,
      email: textoOuNulo(dados, 'email'),
      telefone: textoOuNulo(dados, 'telefone'),
      morada: textoOuNulo(dados, 'morada'),
      activo: booleano(dados, 'activo'),
      notas: textoOuNulo(dados, 'notas'),
    },
    revalidar: ['/financeiro/fornecedores', '/financeiro/despesas'],
    mensagemCriado: `${nome} foi criado. Pode continuar a introduzir fornecedores.`,
  })

  if (!resultado.ok) return resultado
  if (querContinuar(dados)) return resultado
  redirect(comConfirmacao('/financeiro/fornecedores', id ? 'guardado' : 'criado'))
}

export async function apagarFornecedor(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }
  const resultado = await apagar({
    tabela: 'fornecedores',
    id,
    revalidar: ['/financeiro/fornecedores'],
  })
  if (!resultado.ok) return resultado
  redirect(comConfirmacao('/financeiro/fornecedores', 'apagado'))
}

// --- Categorias de despesa --------------------------------------------------

/** Converte "Melhoramentos do espaço" em "melhoramentos-do-espaco". */
function criarSlug(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function guardarCategoria(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = textoOuNulo(dados, 'id')
  const nome = texto(dados, 'nome')
  if (!nome) return { ok: false, mensagem: 'O nome é obrigatório.' }

  const resultado = await gravar({
    tabela: 'categorias_despesa',
    id,
    valores: {
      nome,
      ...(id ? {} : { slug: criarSlug(nome) }),
      ordem: inteiroOuNulo(dados, 'ordem') ?? 100,
      activa: booleano(dados, 'activa'),
    },
    revalidar: ['/financeiro/categorias', '/financeiro/despesas', '/'],
    mensagemCriado: `Categoria ${nome} criada.`,
  })

  if (!resultado.ok) return resultado
  if (querContinuar(dados)) return resultado
  redirect(comConfirmacao('/financeiro/categorias', id ? 'guardado' : 'criado'))
}

export async function apagarCategoria(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }
  const resultado = await apagar({
    tabela: 'categorias_despesa',
    id,
    revalidar: ['/financeiro/categorias'],
  })
  if (!resultado.ok) {
    return {
      ok: false,
      mensagem:
        'Não é possível apagar: há despesas nesta categoria. Marque-a como inactiva.',
    }
  }
  redirect(comConfirmacao('/financeiro/categorias', 'apagado'))
}
