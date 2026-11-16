'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import type {
  PagaFerrador,
  RegimeCavalo,
  SexoCavalo,
  TipoOpcaoCavalo,
} from '@/lib/tipos-bd'
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
import { obterPessoaSessao } from '@/lib/sessao'
import { eGestao } from '@/lib/permissoes'
import { avisar, pessoasDaGestao } from '@/lib/notificacoes/enviar'

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

/**
 * Grava um cavalo, da gestão ou do cliente.
 *
 * O mesmo formulário serve os dois, mas **o que cada um pode dizer é
 * diferente**: o cliente não escolhe regime, proprietário nem estado — isso
 * diz de quem é o cavalo e se ele conta para o centro. Aqui só se decide o
 * que enviar; quem impõe é a trigger `carimbar_cavalo_proposto`, porque uma
 * verificação de interface não tranca nada.
 */
export async function guardarCavalo(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = textoOuNulo(dados, 'id')
  const nome = texto(dados, 'nome')
  if (!nome) return { ok: false, mensagem: 'O nome é obrigatório.' }

  const sessao = await obterPessoaSessao()
  const souGestao = eGestao(sessao?.perfil ?? null)

  const regimeBruto = texto(dados, 'regime')
  if (souGestao && !REGIMES.includes(regimeBruto as RegimeCavalo)) {
    return { ok: false, mensagem: 'Escolha o regime do cavalo.' }
  }
  // Uma proposta é sempre de um cavalo a penso do próprio: é o único arranjo
  // em que faz sentido ser o dono a inscrevê-lo.
  const regime: RegimeCavalo = souGestao
    ? (regimeBruto as RegimeCavalo)
    : 'penso'

  const proprietarioId = souGestao
    ? textoOuNulo(dados, 'proprietario_id')
    : (sessao?.id ?? null)

  if (souGestao && regime === 'penso' && !proprietarioId) {
    return {
      ok: false,
      mensagem: 'Um cavalo a penso tem de ter um proprietário.',
    }
  }

  const sexoBruto = texto(dados, 'sexo')
  const sexo = SEXOS.includes(sexoBruto as SexoCavalo)
    ? (sexoBruto as SexoCavalo)
    : null

  // Sem proprietário não há quem pague directamente ao ferrador: o campo
  // volta ao centro sozinho, em vez de ficar num estado que não se cumpre.
  const pagaFerradorBruto = texto(dados, 'ferrador_pago_por')
  const pagaFerrador: PagaFerrador =
    pagaFerradorBruto === 'proprietario' && regime === 'penso' && proprietarioId
      ? 'proprietario'
      : 'centro'

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
      // Regime, proprietário, estado e quem paga o ferrador só viajam quando
      // é a gestão a escrever. Numa proposta a trigger escreve-os, e enviá-los
      // daqui era dar a entender que o formulário os decide.
      ...(souGestao
        ? {
            regime,
            // Só cavalos a penso guardam proprietário; nos outros regimes o
            // campo fica a null mesmo que o formulário traga um valor antigo.
            proprietario_id: regime === 'penso' ? proprietarioId : null,
            ferrador_pago_por: pagaFerrador,
            activo: booleano(dados, 'activo'),
          }
        : {}),
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

  // Um cavalo inscrito pelo cliente fica à espera de alguém. O que substitui
  // a notificação é `<CavalosPorAprovar>` no painel; o aviso é o atalho.
  if (!souGestao && !id) {
    await avisar(await pessoasDaGestao(), {
      titulo: 'Cavalo novo por aprovar',
      texto: `${sessao?.nome ?? 'Um cliente'} inscreveu ${nome}.`,
      caminho: `/cavalos/${resultado.id}`,
      agrupar: `cavalo-por-aprovar-${resultado.id}`,
    })
  }

  if (querContinuar(dados)) return resultado
  // Gravar volta sempre à listagem, ao criar e ao editar.
  //
  // Ficar na ficha depois de gravar era a decisão anterior, e era ela que dava
  // a sensação de que nada tinha acontecido: a ficha destas duas entidades é
  // o mesmo formulário, com os mesmos vinte campos e os mesmos valores. A
  // listagem é de onde se veio, mostra a alteração na linha, e o aviso de
  // «Alterações guardadas» aparece por cima.
  redirect(comConfirmacao('/cavalos', id ? 'guardado' : 'criado'))
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

/**
 * O que prende um cavalo — e, sobretudo, o que se perderia ao apagá-lo.
 *
 * Só os contratos é que o Postgres trava (`restrict`). Os outros três são
 * perda silenciosa, e é por isso que o travão tem de estar aqui:
 *
 *   despesas.cavalo_id           `set null` — a despesa fica sem saber de que
 *                                 cavalo era (ferrador, veterinário, ração)
 *   evento_participantes.cavalo_id `set null` — as aulas e os treinos que já
 *                                 aconteceram perdem o par aluno↔cavalo
 *   ferracoes                    `cascade`  — o histórico de ferração morre
 *                                 com ele
 *
 * A largada no paddock não entra na conta: `paddock_ocupacao` é `cascade`,
 * mas é o quadro de hoje e não histórico — o cavalo que sai do centro sai do
 * campo, que é precisamente o que se quer.
 */
async function oQuePrendeCavalo(id: string) {
  const supabase = await criarClienteServidor()
  const contar = (
    tabela: 'contratos_penso' | 'despesas' | 'evento_participantes' | 'ferracoes',
  ) =>
    supabase.from(tabela).select('id', { count: 'exact', head: true }).eq('cavalo_id', id)

  const [contratos, despesas, participacoes, ferracoes] = await Promise.all([
    contar('contratos_penso'),
    contar('despesas'),
    contar('evento_participantes'),
    contar('ferracoes'),
  ])

  const partes: string[] = []
  const juntar = (n: number | null, um: string, varios: string) => {
    if (!n) return
    partes.push(n === 1 ? `1 ${um}` : `${n} ${varios}`)
  }

  juntar(contratos.count, 'contrato de penso', 'contratos de penso')
  juntar(despesas.count, 'despesa imputada', 'despesas imputadas')
  juntar(participacoes.count, 'participação em eventos', 'participações em eventos')
  juntar(ferracoes.count, 'ferração registada', 'ferrações registadas')

  if (partes.length === 0) return null
  if (partes.length === 1) return partes[0]
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
}

/**
 * Apagar um cavalo é para a ficha escrita por engano, e mais nada.
 *
 * A verificação é **antes** do apagar e não depois: o Postgres só recusa por
 * causa dos contratos. As despesas e as participações ficavam a apontar para
 * ninguém e as ferrações desapareciam, tudo sem um erro — o que se perdia só
 * dava por si meses depois, a olhar para uma despesa de ferrador sem cavalo.
 */
export async function apagarCavalo(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }

  const prende = await oQuePrendeCavalo(id)
  if (prende) {
    return {
      ok: false,
      mensagem: `Não dá para apagar: este cavalo tem ${prende}. Desactive-o — sai das listas e das convocatórias, e tudo o que já lá está fica de pé.`,
    }
  }

  const resultado = await apagar({ tabela: 'cavalos', id, revalidar: ['/cavalos'] })

  if (!resultado.ok) {
    return {
      ok: false,
      mensagem:
        'Não dá para apagar: este cavalo está a ser usado noutro sítio. Desactive-o em vez de o apagar.',
    }
  }

  redirect(comConfirmacao('/cavalos', 'apagado'))
}

/**
 * Tira um cavalo da circulação, ou volta a pô-lo.
 *
 * É o que se faz ao cavalo que saiu do centro: deixa de aparecer nas listas e
 * nos formulários de convocatória, e tudo o que já lá está — despesas,
 * ferrações, participações — fica de pé.
 */
export async function alternarActivoCavalo(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }

  const supabase = await criarClienteServidor()
  const { data: cavalo, error: erroLeitura } = await supabase
    .from('cavalos')
    .select('nome, activo')
    .eq('id', id)
    .maybeSingle()

  if (erroLeitura) return { ok: false, mensagem: traduzirErro(erroLeitura) }
  if (!cavalo) return { ok: false, mensagem: 'Cavalo não encontrado.' }

  const activar = !cavalo.activo
  const { error } = await supabase
    .from('cavalos')
    .update({ activo: activar })
    .eq('id', id)

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  revalidatePath('/cavalos')
  revalidatePath(`/cavalos/${id}`)

  return {
    ok: true,
    mensagem: activar
      ? `${cavalo.nome} voltou às listas.`
      : `${cavalo.nome} ficou inactivo. Sai das listas, e o histórico fica.`,
  }
}

// --- Aprovação de cavalos propostos ------------------------------------------

/**
 * A gestão confirma a ficha que o cliente inscreveu.
 *
 * Só isto: `aprovado_em` passa a ter data, e o cavalo entra no centro. Os
 * campos que a trigger impôs — regime, proprietário — corrigem-se na ficha
 * como em qualquer outro cavalo, e já com a gestão a escrever.
 *
 * A guarda `e_gestao()` está na RLS; a verificação aqui serve para a mensagem
 * de erro dizer a verdade em vez de «registo não encontrado».
 */
export async function aprovarCavalo(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }

  const sessao = await obterPessoaSessao()
  if (!eGestao(sessao?.perfil ?? null)) {
    return { ok: false, mensagem: 'Só a gestão aprova fichas de cavalo.' }
  }

  const supabase = await criarClienteServidor()
  const { data: cavalo, error } = await supabase
    .from('cavalos')
    .update({ aprovado_em: new Date().toISOString(), aprovado_por: sessao!.id })
    .eq('id', id)
    .is('aprovado_em', null)
    .select('nome, criado_por_id, proprietario_id')
    .maybeSingle()

  if (error) return { ok: false, mensagem: traduzirErro(error) }
  if (!cavalo) {
    return { ok: false, mensagem: 'Esta ficha já tinha sido decidida.' }
  }

  revalidatePath('/cavalos')
  revalidatePath(`/cavalos/${id}`)
  revalidatePath('/')

  await avisar([cavalo.criado_por_id ?? cavalo.proprietario_id ?? ''], {
    titulo: `${cavalo.nome} está registado`,
    texto: 'A gestão confirmou a ficha do seu cavalo.',
    caminho: `/cavalos/${id}`,
    agrupar: `cavalo-decidido-${id}`,
  })

  return { ok: true, mensagem: `${cavalo.nome} foi aprovado.` }
}

/**
 * A gestão recusa a proposta, e a ficha desaparece.
 *
 * **Não há estado «recusado»**: uma ficha que não corresponde a nenhum cavalo
 * do centro não tem razão para ficar na listagem a ser filtrada para sempre.
 * O que fica é o aviso ao cliente, e por isso **o motivo é obrigatório** — é
 * a única coisa que ele vai ler, e sem ela a ficha dele desaparecia sem
 * explicação. É a mesma regra da recusa de um pagamento declarado.
 *
 * Lê-se o cavalo **antes** de apagar: depois não há de quem falar.
 */
export async function recusarCavalo(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  const motivo = texto(dados, 'motivo')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }
  if (!motivo) {
    return {
      ok: false,
      mensagem: 'Escreva o motivo — é o que o cliente vai receber.',
    }
  }

  const sessao = await obterPessoaSessao()
  if (!eGestao(sessao?.perfil ?? null)) {
    return { ok: false, mensagem: 'Só a gestão decide fichas de cavalo.' }
  }

  const supabase = await criarClienteServidor()
  const { data: cavalo } = await supabase
    .from('cavalos')
    .select('nome, criado_por_id, proprietario_id, aprovado_em')
    .eq('id', id)
    .maybeSingle()

  if (!cavalo) return { ok: false, mensagem: 'Ficha não encontrada.' }
  if (cavalo.aprovado_em) {
    return {
      ok: false,
      mensagem:
        'Esta ficha já foi aprovada. Para a tirar do centro, desactive-a ou apague-a na ficha.',
    }
  }

  const { error } = await supabase.from('cavalos').delete().eq('id', id)
  if (error) return { ok: false, mensagem: traduzirErro(error) }

  revalidatePath('/cavalos')
  revalidatePath('/')

  await avisar([cavalo.criado_por_id ?? cavalo.proprietario_id ?? ''], {
    titulo: `${cavalo.nome} não ficou registado`,
    texto: motivo,
    caminho: '/cavalos',
    agrupar: `cavalo-decidido-${id}`,
  })

  return {
    ok: true,
    mensagem: `${cavalo.nome} foi recusado e o cliente foi avisado.`,
  }
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
