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

  /*
   * Coluna ou tabela que o código conhece e a base ainda não.
   *
   * Acontece na janela entre a Vercel publicar e a migração ser aplicada, e
   * já aconteceu de verdade. A mensagem crua do Postgres («column … does not
   * exist») não diz nada a quem está a usar a aplicação, e o que é preciso
   * fazer é sempre o mesmo.
   */
  if (codigo === '42703' || codigo === '42P01' || codigo === 'PGRST204') {
    return 'A base de dados está desactualizada: falta aplicar a última migração no Supabase. Avise quem trata disso — nada do que escreveu se perdeu.'
  }

  return erro.message || 'Ocorreu um erro inesperado.'
}

/**
 * Traduz erros de autenticação do Supabase (o envio do convite, sobretudo).
 *
 * Isto existe porque a mensagem que estava aqui antes era uma só, fixa, a
 * dizer que o Supabase limita o número de emails por hora. Assumia uma causa
 * em vez de mostrar a verdadeira: com o SMTP mal configurado — remetente não
 * verificado no fornecedor, chave de SMTP trocada pela palavra-passe da conta,
 * Login errado — o Supabase devolve um 500 «Error sending …», que não tem nada
 * a ver com limites. Quem lia a mensagem esperava uma hora à toa.
 *
 * A mensagem crua vai sempre no fim, entre parênteses: é o que permite a quem
 * está ao balcão repetir ao telefone o que a aplicação disse.
 */
export function traduzirErroAutenticacao(erro: {
  code?: string
  status?: number
  message?: string
}): string {
  const codigo = erro.code ?? ''
  const estado = erro.status ?? 0
  const bruto = erro.message ?? ''
  const texto = bruto.toLowerCase()
  const cru = bruto ? ` (${bruto})` : ''

  if (estado === 429 || codigo === 'over_email_send_rate_limit') {
    return `Demasiados emails num curto espaço de tempo. O Supabase tem um limite por hora em Authentication → Rate Limits — aumente-o ou tente daqui a pouco.${cru}`
  }

  if (estado >= 500 || texto.includes('error sending')) {
    return `O Supabase não conseguiu entregar o email ao servidor de envio. Confirme o SMTP em Authentication → Emails: remetente verificado no fornecedor, e a chave de SMTP (não a palavra-passe da conta) no campo da palavra-passe.${cru}`
  }

  if (codigo === 'signup_disabled' || codigo === 'email_provider_disabled') {
    return `O Supabase tem as contas por email desligadas. Ligue-as em Authentication → Providers → Email.${cru}`
  }

  if (codigo === 'validation_failed' || texto.includes('invalid email')) {
    return `O Supabase recusou o endereço de email da ficha. Verifique se está bem escrito.${cru}`
  }

  return `Não foi possível enviar o convite.${cru || ' O Supabase não disse porquê.'}`
}
