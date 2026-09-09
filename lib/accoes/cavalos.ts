'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import type { RegimeCavalo, SexoCavalo } from '@/lib/tipos-bd'
import { ROTULOS_REGIME, ROTULOS_SEXO } from '@/lib/rotulos'
import {
  apagar,
  booleano,
  gravar,
  querContinuar,
  texto,
  textoOuNulo,
} from './comum'
import { traduzirErro, type ResultadoAccao } from './resultado'

const REGIMES = Object.keys(ROTULOS_REGIME) as RegimeCavalo[]
const SEXOS = Object.keys(ROTULOS_SEXO) as SexoCavalo[]

export async function guardarCavalo(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = textoOuNulo(dados, 'id')
  const nome = texto(dados, 'nome')
  if (!nome) return { ok: false, mensagem: 'O nome é obrigatório.' }

  const regimeBruto = texto(dados, 'regime')
  if (!REGIMES.includes(regimeBruto as RegimeCavalo)) {
    return { ok: false, mensagem: 'Escolha o regime do cavalo.' }
  }
  const regime = regimeBruto as RegimeCavalo

  const proprietarioId = textoOuNulo(dados, 'proprietario_id')
  if (regime === 'penso' && !proprietarioId) {
    return {
      ok: false,
      mensagem: 'Um cavalo a penso tem de ter um proprietário.',
    }
  }

  const sexoBruto = texto(dados, 'sexo')
  const sexo = SEXOS.includes(sexoBruto as SexoCavalo)
    ? (sexoBruto as SexoCavalo)
    : null

  // O ficheiro já foi para o Storage a partir do browser; aqui só chega o
  // caminho. Ver components/campo-ficheiro.tsx.
  const fotoPath = textoOuNulo(dados, 'foto_path')

  const resultado = await gravar({
    tabela: 'cavalos',
    id,
    valores: {
      nome,
      data_nascimento: textoOuNulo(dados, 'data_nascimento'),
      sexo,
      raca: textoOuNulo(dados, 'raca'),
      pelagem: textoOuNulo(dados, 'pelagem'),
      num_passaporte: textoOuNulo(dados, 'num_passaporte'),
      microchip: textoOuNulo(dados, 'microchip'),
      regime,
      // Só cavalos a penso guardam proprietário; nos outros regimes o campo
      // fica a null mesmo que o formulário traga um valor antigo.
      proprietario_id: regime === 'penso' ? proprietarioId : null,
      activo: booleano(dados, 'activo'),
      notas: textoOuNulo(dados, 'notas'),
      ...(fotoPath ? { foto_path: fotoPath } : {}),
    },
    revalidar: ['/cavalos'],
    mensagemCriado: `${nome} foi criado. Pode continuar a introduzir cavalos.`,
  })

  if (!resultado.ok || !resultado.id) return resultado

  revalidatePath('/cavalos')
  revalidatePath(`/cavalos/${resultado.id}`)

  if (querContinuar(dados)) return resultado
  redirect(`/cavalos/${resultado.id}`)
}

export async function apagarCavalo(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }

  const resultado = await apagar({ tabela: 'cavalos', id, revalidar: ['/cavalos'] })

  if (!resultado.ok) {
    return {
      ok: false,
      mensagem:
        'Não é possível apagar: o cavalo tem contratos ou despesas associados. Marque-o como inactivo.',
    }
  }

  redirect('/cavalos')
}

/** Atribui (ou liberta) a box de um cavalo a partir da ficha do cavalo. */
export async function atribuirBox(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const cavaloId = texto(dados, 'cavalo_id')
  const boxId = textoOuNulo(dados, 'box_id')
  if (!cavaloId) return { ok: false, mensagem: 'Registo inválido.' }

  const supabase = await criarClienteServidor()

  // Uma box só tem um cavalo: liberta primeiro a box anterior deste cavalo.
  const { error: erroLibertar } = await supabase
    .from('boxes')
    .update({ cavalo_id: null })
    .eq('cavalo_id', cavaloId)

  if (erroLibertar) return { ok: false, mensagem: traduzirErro(erroLibertar) }

  if (boxId) {
    const { error } = await supabase
      .from('boxes')
      .update({ cavalo_id: cavaloId })
      .eq('id', boxId)
    if (error) return { ok: false, mensagem: traduzirErro(error) }
  }

  revalidatePath('/boxes')
  revalidatePath(`/cavalos/${cavaloId}`)
  return { ok: true, mensagem: 'Box actualizada.' }
}
