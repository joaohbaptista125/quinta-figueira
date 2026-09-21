'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import type { RegimeCavalo, SexoCavalo, TipoOpcaoCavalo } from '@/lib/tipos-bd'
import { ROTULOS_REGIME, ROTULOS_SEXO } from '@/lib/rotulos'
import { normalizarOpcao, VALOR_NOVA } from '@/lib/opcoes-cavalo'
import {
  apagar,
  comConfirmacao,
  booleano,
  gravar,
  querContinuar,
  texto,
  textoOuNulo,
} from './comum'
import { traduzirErro, type ResultadoAccao } from './resultado'

const REGIMES = Object.keys(ROTULOS_REGIME) as RegimeCavalo[]
const SEXOS = Object.keys(ROTULOS_SEXO) as SexoCavalo[]

/**
 * Lê um campo que é uma escolha da lista ou um valor escrito à mão.
 *
 * `nova` diz se veio da caixa de texto — só nesse caso é preciso gravar a
 * opção na lista. Ver `components/formularios/selector-com-outro.tsx`.
 */
function opcaoOuNova(
  dados: FormData,
  campo: string,
): { valor: string | null; nova: boolean } {
  const escolhido = texto(dados, campo)

  if (escolhido !== VALOR_NOVA) {
    return { valor: escolhido === '' ? null : escolhido, nova: false }
  }

  const escrito = normalizarOpcao(texto(dados, `${campo}_nova`))
  return { valor: escrito === '' ? null : escrito, nova: escrito !== '' }
}

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

  const raca = opcaoOuNova(dados, 'raca')
  const pelagem = opcaoOuNova(dados, 'pelagem')

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
      raca: raca.valor,
      pelagem: pelagem.valor,
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

  // Uma raça escrita à mão passa a fazer parte da lista, que é o que faz com
  // que da próxima vez já esteja lá para escolher.
  if (raca.nova) await registarOpcao('raca', raca.valor)
  if (pelagem.nova) await registarOpcao('pelagem', pelagem.valor)

  revalidatePath('/cavalos')
  revalidatePath(`/cavalos/${resultado.id}`)

  if (querContinuar(dados)) return resultado
  // Criar volta à listagem; editar fica na ficha, que é de onde se veio.
  // Cair na ficha depois de criar dava a sensação de que nada tinha
  // acontecido: a ficha é o mesmo formulário, com os mesmos valores.
  redirect(
    id
      ? comConfirmacao(`/cavalos/${resultado.id}`, 'guardado')
      : comConfirmacao('/cavalos', 'criado'),
  )
}

/**
 * Acrescenta uma raça ou pelagem à lista, se ainda lá não estiver.
 *
 * Um duplicado (23505) não é erro nenhum: significa que outra pessoa a
 * acrescentou entretanto, e o objectivo — a opção existir — está cumprido. O
 * cavalo já foi gravado, por isso nada aqui pode fazer falhar a gravação.
 */
async function registarOpcao(tipo: TipoOpcaoCavalo, valor: string | null) {
  if (!valor) return
  const supabase = await criarClienteServidor()
  await supabase.from('opcoes_cavalo').insert({ tipo, valor })
  revalidatePath('/cavalos/opcoes')
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

  redirect(comConfirmacao('/cavalos', 'apagado'))
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

// --- Raças e pelagens -------------------------------------------------------

const CAMINHOS_OPCOES = ['/cavalos/opcoes', '/cavalos']

function validarTipo(dados: FormData): TipoOpcaoCavalo | null {
  const tipo = texto(dados, 'tipo')
  return tipo === 'raca' || tipo === 'pelagem' ? tipo : null
}

export async function criarOpcaoCavalo(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const tipo = validarTipo(dados)
  if (!tipo) return { ok: false, mensagem: 'Registo inválido.' }

  const valor = normalizarOpcao(texto(dados, 'valor'))
  if (!valor) return { ok: false, mensagem: 'Escreva o nome antes de gravar.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.from('opcoes_cavalo').insert({ tipo, valor })
  if (error) return { ok: false, mensagem: traduzirErro(error) }

  for (const caminho of CAMINHOS_OPCOES) revalidatePath(caminho)
  return { ok: true, mensagem: `«${valor}» acrescentado à lista.` }
}

/**
 * Muda o nome de uma raça ou pelagem, e muda-o também nos cavalos.
 *
 * `cavalos.raca` é texto e não uma chave estrangeira — ver a migração —, por
 * isso mudar só a lista deixaria os cavalos com o nome antigo e a opção velha
 * a reaparecer na ficha deles. As duas coisas andam juntas.
 */
export async function renomearOpcaoCavalo(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }

  const novo = normalizarOpcao(texto(dados, 'valor'))
  if (!novo) return { ok: false, mensagem: 'O nome não pode ficar vazio.' }

  const supabase = await criarClienteServidor()
  const { data: antiga } = await supabase
    .from('opcoes_cavalo')
    .select('tipo, valor')
    .eq('id', id)
    .maybeSingle()

  if (!antiga) return { ok: false, mensagem: 'Opção não encontrada.' }
  if (antiga.valor === novo) return { ok: true }

  const { error } = await supabase
    .from('opcoes_cavalo')
    .update({ valor: novo })
    .eq('id', id)
  if (error) return { ok: false, mensagem: traduzirErro(error) }

  // Escrito assim, e não com uma coluna calculada, porque os tipos da base
  // exigem uma chave literal — e é isso que impede um campo inventado.
  const { error: erroCavalos } =
    antiga.tipo === 'raca'
      ? await supabase
          .from('cavalos')
          .update({ raca: novo })
          .eq('raca', antiga.valor)
      : await supabase
          .from('cavalos')
          .update({ pelagem: novo })
          .eq('pelagem', antiga.valor)

  if (erroCavalos) {
    return {
      ok: false,
      mensagem: `A lista foi alterada, mas os cavalos ficaram com «${antiga.valor}»: ${traduzirErro(erroCavalos)}`,
    }
  }

  for (const caminho of CAMINHOS_OPCOES) revalidatePath(caminho)
  return { ok: true, mensagem: `«${antiga.valor}» passou a «${novo}».` }
}

/**
 * Tira uma opção da lista, ou põe-na de volta.
 *
 * Desactivar não é apagar de propósito: os cavalos que a usam continuam a
 * mostrá-la, só deixa de aparecer a quem está a escolher. Apagar obrigaria a
 * decidir o que fazer a esses cavalos, e a resposta certa é quase sempre
 * deixá-los em paz.
 */
export async function alternarOpcaoCavalo(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }
  const activa = booleano(dados, 'activa')

  const supabase = await criarClienteServidor()
  const { error } = await supabase
    .from('opcoes_cavalo')
    .update({ activa })
    .eq('id', id)

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  for (const caminho of CAMINHOS_OPCOES) revalidatePath(caminho)
  return { ok: true, mensagem: activa ? 'De volta à lista.' : 'Fora da lista.' }
}
