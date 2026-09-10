'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import type { PapelPessoa, PerfilAcesso } from '@/lib/tipos-bd'
import { ROTULOS_PAPEL, ROTULOS_PERFIL } from '@/lib/rotulos'
import {
  apagar,
  comConfirmacao,
  booleano,
  gravar,
  listaTexto,
  querContinuar,
  texto,
  textoOuNulo,
} from './comum'
import { traduzirErro, type ResultadoAccao } from './resultado'

const PAPEIS_VALIDOS = Object.keys(ROTULOS_PAPEL) as PapelPessoa[]
const PERFIS_VALIDOS = Object.keys(ROTULOS_PERFIL) as PerfilAcesso[]

export async function guardarPessoa(
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

  const perfilBruto = texto(dados, 'perfil')
  const perfil =
    perfilBruto && PERFIS_VALIDOS.includes(perfilBruto as PerfilAcesso)
      ? (perfilBruto as PerfilAcesso)
      : null

  const resultado = await gravar({
    tabela: 'pessoas',
    id,
    valores: {
      nome,
      email: textoOuNulo(dados, 'email'),
      telefone: textoOuNulo(dados, 'telefone'),
      nif,
      morada: textoOuNulo(dados, 'morada'),
      notas: textoOuNulo(dados, 'notas'),
      activo: booleano(dados, 'activo'),
      perfil,
    },
    revalidar: ['/pessoas'],
    mensagemCriado: `${nome} foi criado. Pode continuar a introduzir pessoas.`,
  })

  if (!resultado.ok || !resultado.id) return resultado

  const erroPapeis = await sincronizarPapeis(
    resultado.id,
    listaTexto(dados, 'papeis').filter((papel): papel is PapelPessoa =>
      PAPEIS_VALIDOS.includes(papel as PapelPessoa),
    ),
  )
  if (erroPapeis) return { ok: false, mensagem: erroPapeis }

  revalidatePath('/pessoas')
  revalidatePath(`/pessoas/${resultado.id}`)

  if (querContinuar(dados)) return resultado
  redirect(comConfirmacao(`/pessoas/${resultado.id}`, id ? 'guardado' : 'criado'))
}

/** Substitui o conjunto de papéis da pessoa pelo indicado no formulário. */
async function sincronizarPapeis(pessoaId: string, papeis: PapelPessoa[]) {
  const supabase = await criarClienteServidor()

  // Retira os que deixaram de estar marcados. Com a lista vazia apaga todos —
  // um filtro `in ()` vazio seria SQL inválido.
  const remocao = supabase.from('pessoa_papeis').delete().eq('pessoa_id', pessoaId)
  const { error: erroApagar } =
    papeis.length > 0
      ? await remocao.not('papel', 'in', `(${papeis.join(',')})`)
      : await remocao

  if (erroApagar) return traduzirErro(erroApagar)
  if (papeis.length === 0) return null

  const { error: erroInserir } = await supabase
    .from('pessoa_papeis')
    .upsert(
      papeis.map((papel) => ({ pessoa_id: pessoaId, papel })),
      { onConflict: 'pessoa_id,papel', ignoreDuplicates: true },
    )

  return erroInserir ? traduzirErro(erroInserir) : null
}

export async function apagarPessoa(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }

  const resultado = await apagar({
    tabela: 'pessoas',
    id,
    revalidar: ['/pessoas'],
  })

  if (!resultado.ok) {
    return {
      ok: false,
      mensagem:
        resultado.mensagem === 'Não é possível: o registo está a ser usado noutro sítio.'
          ? 'Não é possível apagar: esta pessoa tem cavalos, contratos ou recebimentos associados. Marque-a como inactiva.'
          : resultado.mensagem,
    }
  }

  redirect(comConfirmacao('/pessoas', 'apagado'))
}
