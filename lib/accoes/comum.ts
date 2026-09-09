import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { lerValorMonetario } from '@/lib/formatos'
import { traduzirErro, type ResultadoAccao } from './resultado'

// --- Leitura de FormData ----------------------------------------------------

export function texto(dados: FormData, campo: string) {
  const valor = dados.get(campo)
  return typeof valor === 'string' ? valor.trim() : ''
}

/** Campos opcionais: string vazia é guardada como NULL, não como ''. */
export function textoOuNulo(dados: FormData, campo: string) {
  const valor = texto(dados, campo)
  return valor === '' ? null : valor
}

export function booleano(dados: FormData, campo: string) {
  return dados.get(campo) === 'on' || dados.get(campo) === 'true'
}

export function inteiroOuNulo(dados: FormData, campo: string) {
  const valor = texto(dados, campo)
  if (valor === '') return null
  const n = Number.parseInt(valor, 10)
  return Number.isFinite(n) ? n : null
}

export function valorOuNulo(dados: FormData, campo: string) {
  return lerValorMonetario(texto(dados, campo))
}

export function listaTexto(dados: FormData, campo: string) {
  return dados
    .getAll(campo)
    .filter((valor): valor is string => typeof valor === 'string')
    .map((valor) => valor.trim())
    .filter(Boolean)
}

export function querContinuar(dados: FormData) {
  return texto(dados, 'continuar') === 'sim'
}

// --- Escrita ----------------------------------------------------------------

type OpcoesGravacao = {
  tabela: string
  id: string | null
  valores: Record<string, unknown>
  /** Caminhos a invalidar na cache do Next. */
  revalidar: string[]
  mensagemCriado: string
  mensagemActualizado?: string
}

/**
 * Insere ou actualiza um registo e devolve o resultado.
 *
 * Não redirecciona: quem chama decide se fica na página (para criar outro
 * registo) ou se volta à listagem — `redirect()` funciona por excepção e não
 * pode ser chamado aqui dentro sem complicar o tratamento de erros.
 */
export async function gravar({
  tabela,
  id,
  valores,
  revalidar,
  mensagemCriado,
  mensagemActualizado = 'Alterações guardadas.',
}: OpcoesGravacao): Promise<ResultadoAccao & { id?: string }> {
  const supabase = await criarClienteServidor()
  // A tabela é escolhida por quem chama, sempre a partir de um literal do
  // código — nunca vem do pedido.
  const consulta = supabase.from(tabela as never)

  const { data, error } = id
    ? await consulta
        .update(valores as never)
        .eq('id', id)
        .select('id')
        .maybeSingle()
    : await consulta
        .insert(valores as never)
        .select('id')
        .maybeSingle()

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  if (id && !data) {
    return {
      ok: false,
      mensagem: 'Registo não encontrado ou sem permissão para o alterar.',
    }
  }

  for (const caminho of revalidar) revalidatePath(caminho)

  return {
    ok: true,
    mensagem: id ? mensagemActualizado : mensagemCriado,
    id: (data as { id?: string } | null)?.id ?? id ?? undefined,
  }
}

export async function apagar({
  tabela,
  id,
  revalidar,
}: {
  tabela: string
  id: string
  revalidar: string[]
}): Promise<ResultadoAccao> {
  const supabase = await criarClienteServidor()
  const { error } = await supabase
    .from(tabela as never)
    .delete()
    .eq('id', id)

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  for (const caminho of revalidar) revalidatePath(caminho)
  return { ok: true }
}
