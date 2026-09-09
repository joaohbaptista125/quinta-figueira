/**
 * Configuração de ligação ao Supabase.
 *
 * O projecto arranca com valores de exemplo para ser possível correr `npm run
 * dev` e `npm run build` antes de existirem chaves reais. Quando a configuração
 * é de exemplo, a aplicação mostra a página de instruções em vez de rebentar
 * com erros de rede.
 */

export const URL_EXEMPLO = 'https://exemplo-substituir.supabase.co'
export const CHAVE_EXEMPLO = 'chave-anonima-de-exemplo-substituir'

export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || URL_EXEMPLO

export const supabaseChaveAnonima =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  CHAVE_EXEMPLO

/** Falso enquanto as chaves reais não forem colocadas no ambiente. */
export const supabaseConfigurado =
  supabaseUrl !== URL_EXEMPLO && supabaseChaveAnonima !== CHAVE_EXEMPLO
