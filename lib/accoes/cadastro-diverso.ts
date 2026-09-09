'use server'

import { redirect } from 'next/navigation'
import {
  apagar,
  booleano,
  gravar,
  inteiroOuNulo,
  querContinuar,
  texto,
  textoOuNulo,
  valorOuNulo,
} from './comum'
import type { ResultadoAccao } from './resultado'

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
  redirect('/boxes')
}

export async function apagarBox(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }
  const resultado = await apagar({ tabela: 'boxes', id, revalidar: ['/boxes'] })
  if (!resultado.ok) return resultado
  redirect('/boxes')
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
    revalidar: ['/contratos', '/financeiro/pensos'],
    mensagemCriado: 'Contrato criado. Pode continuar a introduzir contratos.',
  })

  if (!resultado.ok) return resultado
  if (querContinuar(dados)) return resultado
  redirect('/contratos')
}

export async function apagarContrato(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }
  const resultado = await apagar({
    tabela: 'contratos_penso',
    id,
    revalidar: ['/contratos', '/financeiro/pensos'],
  })
  if (!resultado.ok) return resultado
  redirect('/contratos')
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
  redirect('/financeiro/contas')
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
  redirect('/financeiro/contas')
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
  redirect('/financeiro/fornecedores')
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
  redirect('/financeiro/fornecedores')
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
  redirect('/financeiro/categorias')
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
  redirect('/financeiro/categorias')
}
