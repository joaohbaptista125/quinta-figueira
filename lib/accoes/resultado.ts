/** Resultado devolvido pelas Server Actions usadas com useActionState. */
export type ResultadoAccao = {
  ok: boolean
  mensagem?: string
  erros?: Record<string, string>
}

export const SEM_RESULTADO: ResultadoAccao = { ok: false }

/**
 * Traduz erros do PostgREST/Postgres para mensagens em português.
 * Os códigos vêm do Postgres; a mensagem crua é técnica e em inglês.
 */
export function traduzirErro(erro: {
  code?: string
  message?: string
  details?: string | null
}): string {
  const codigo = erro.code ?? ''
  const texto = `${erro.message ?? ''} ${erro.details ?? ''}`

  if (codigo === '23505') {
    if (texto.includes('nif')) return 'Já existe um registo com este NIF.'
    if (texto.includes('email')) return 'Já existe um registo com este email.'
    if (texto.includes('passaporte'))
      return 'Já existe um cavalo com este número de passaporte.'
    if (texto.includes('microchip'))
      return 'Já existe um cavalo com este microchip.'
    if (texto.includes('identificacao'))
      return 'Já existe uma box com esta identificação.'
    if (texto.includes('cavalo_id'))
      return 'Esse cavalo já está atribuído a outra box.'
    if (texto.includes('contrato_periodo'))
      return 'Já existe uma mensalidade deste contrato para o período indicado.'
    return 'Já existe um registo igual.'
  }

  if (codigo === '23P01')
    return 'Este cavalo já tem um contrato de penso a sobrepor-se a estas datas.'

  if (codigo === '23514') {
    if (texto.includes('penso_exige_proprietario'))
      return 'Um cavalo a penso tem de ter proprietário.'
    if (texto.includes('nif'))
      return 'O NIF tem de ter exactamente 9 dígitos.'
    if (texto.includes('datas_coerentes'))
      return 'A data de fim não pode ser anterior à data de início.'
    if (texto.includes('login_exige_perfil'))
      return 'Quem tem acesso à aplicação precisa de um perfil.'
    return 'Os dados não respeitam uma regra da base de dados.'
  }

  if (codigo === '23503')
    return 'Não é possível: o registo está a ser usado noutro sítio.'

  if (codigo === '42501' || codigo === 'PGRST301')
    return 'Não tem permissão para esta operação.'

  return erro.message || 'Ocorreu um erro inesperado.'
}
