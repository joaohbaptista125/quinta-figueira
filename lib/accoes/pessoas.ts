'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { criarClienteSemSessao } from '@/lib/supabase/sem-sessao'
import { obterOrigem, obterPessoaSessao } from '@/lib/sessao'
import { eGestao } from '@/lib/permissoes'
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
import {
  traduzirErro,
  traduzirErroAutenticacao,
  type ResultadoAccao,
} from './resultado'

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
  // Gravar volta sempre à listagem, ao criar e ao editar.
  //
  // Ficar na ficha depois de gravar era a decisão anterior, e era ela que dava
  // a sensação de que nada tinha acontecido: a ficha destas duas entidades é
  // o mesmo formulário, com os mesmos vinte campos e os mesmos valores. A
  // listagem é de onde se veio, mostra a alteração na linha, e o aviso de
  // «Alterações guardadas» aparece por cima.
  redirect(comConfirmacao('/pessoas', id ? 'guardado' : 'criado'))
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

/**
 * Conta o que prende uma pessoa à aplicação, para a recusa dizer o que é.
 *
 * As chaves estrangeiras são `on delete restrict`, e isso é de propósito:
 * ninguém apaga um histórico de pagamentos por engano. Mas a mensagem que
 * daqui saía era «tem cavalos, contratos ou recebimentos» — e depois a pessoa
 * ficava a abrir separadores à procura de qual deles.
 *
 * As contagens correm em paralelo e só pedem a contagem, não as linhas.
 */
async function oQuePrendePessoa(id: string) {
  const supabase = await criarClienteServidor()
  const contar = (tabela: 'cavalos' | 'contratos_penso' | 'recebimentos', coluna: string) =>
    supabase
      .from(tabela)
      .select('id', { count: 'exact', head: true })
      .eq(coluna, id)

  const [cavalos, contratos, recebimentos] = await Promise.all([
    contar('cavalos', 'proprietario_id'),
    contar('contratos_penso', 'cliente_id'),
    contar('recebimentos', 'pessoa_id'),
  ])

  const partes: string[] = []
  const juntar = (n: number | null, um: string, varios: string) => {
    if (!n) return
    partes.push(n === 1 ? `1 ${um}` : `${n} ${varios}`)
  }

  juntar(cavalos.count, 'cavalo', 'cavalos')
  juntar(contratos.count, 'contrato de penso', 'contratos de penso')
  juntar(recebimentos.count, 'pagamento registado', 'pagamentos registados')

  if (partes.length === 0) return null
  if (partes.length === 1) return partes[0]
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
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
    if (
      resultado.mensagem === 'Não é possível: o registo está a ser usado noutro sítio.'
    ) {
      const prende = await oQuePrendePessoa(id)
      return {
        ok: false,
        mensagem: prende
          ? `Não dá para apagar: esta ficha tem ${prende}. Desactive-a — sai das listas e deixa de contar, e o histórico fica de pé.`
          : 'Não dá para apagar: esta ficha está a ser usada noutro sítio. Desactive-a em vez de a apagar.',
      }
    }
    return resultado
  }

  redirect(comConfirmacao('/pessoas', 'apagado'))
}

/**
 * Tira uma pessoa da circulação, ou volta a pô-la.
 *
 * É o que se faz a quem sai do centro, e é quase sempre isto e não apagar: o
 * que ela pagou e os cavalos que teve são história que o centro precisa de
 * manter. Existe à parte do formulário porque estava escondido numa caixa a
 * meio de vinte campos, e ninguém a encontrava quando a recusa de apagar
 * mandava «marque como inactiva».
 */
export async function alternarActivoPessoa(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }

  const sessao = await obterPessoaSessao()
  if (!sessao || !eGestao(sessao.perfil)) {
    return { ok: false, mensagem: 'Sem permissão para esta operação.' }
  }
  if (sessao.id === id) {
    return { ok: false, mensagem: 'Não se pode desactivar a si próprio.' }
  }

  const supabase = await criarClienteServidor()
  const { data: pessoa, error: erroLeitura } = await supabase
    .from('pessoas')
    .select('nome, activo')
    .eq('id', id)
    .maybeSingle()

  if (erroLeitura) return { ok: false, mensagem: traduzirErro(erroLeitura) }
  if (!pessoa) return { ok: false, mensagem: 'Pessoa não encontrada.' }

  const activar = !pessoa.activo
  const { error } = await supabase
    .from('pessoas')
    .update({ activo: activar })
    .eq('id', id)

  if (error) return { ok: false, mensagem: traduzirErro(error) }

  revalidatePath('/pessoas')
  revalidatePath(`/pessoas/${id}`)

  return {
    ok: true,
    mensagem: activar
      ? `${pessoa.nome} voltou às listas.`
      : `${pessoa.nome} ficou inactiva. Sai das listas, e o histórico fica.`,
  }
}

// --- Convite de acesso ------------------------------------------------------

/**
 * Envia a uma pessoa o convite para entrar na aplicação.
 *
 * O convite é um link de email. Não há registo público: ninguém se inscreve
 * sozinho, é a gestão que abre a porta a quem precisa. Quando a pessoa carrega
 * no link, a conta nasce e a trigger `ligar_pessoa_ao_criar_utilizador` liga-a
 * à ficha com o mesmo email — por isso o email da ficha tem de ser o mesmo
 * para onde o convite vai.
 *
 * O envio usa um cliente novo, sem cookies, de propósito: `signInWithOtp` toca
 * no armazenamento de sessão do cliente que o chama, e com o cliente de
 * servidor normal isso arriscava mexer na sessão de quem está a convidar.
 */
export async function convidarPessoa(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const id = texto(dados, 'id')
  if (!id) return { ok: false, mensagem: 'Registo inválido.' }

  const sessao = await obterPessoaSessao()
  if (!sessao || !eGestao(sessao.perfil)) {
    return { ok: false, mensagem: 'Sem permissão para convidar.' }
  }

  const supabase = await criarClienteServidor()
  const { data: pessoa, error } = await supabase
    .from('pessoas')
    // `*` e não a lista de colunas de propósito: entre a Vercel publicar e a
    // migração ser aplicada, pedir uma coluna que ainda não existe fazia a
    // operação inteira falhar. Assim o campo vem indefinido e o convite segue.
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) return { ok: false, mensagem: traduzirErro(error) }
  if (!pessoa) return { ok: false, mensagem: 'Pessoa não encontrada.' }

  if (!pessoa.email) {
    return {
      ok: false,
      mensagem: 'Esta ficha não tem email. Preencha-o primeiro — é para lá que o convite vai.',
    }
  }
  // Repare-se que o travão é `acesso_confirmado_em` e não `auth_user_id`: a
  // linha em auth.users nasce com o envio do convite, não com a entrada. Um
  // travão por `auth_user_id` impedia reenviar o convite a quem ainda não
  // tinha entrado uma única vez — que era precisamente quem precisava dele.
  if (pessoa.acesso_confirmado_em) {
    return {
      ok: false,
      mensagem: `${pessoa.nome} já entrou na aplicação. Se perdeu a palavra-passe, use «Esqueci-me da palavra-passe» no ecrã de entrada.`,
    }
  }
  if (!pessoa.activo) {
    return { ok: false, mensagem: 'A ficha está inactiva. Reactive-a antes de convidar.' }
  }

  const origem = await obterOrigem()
  const { error: erroEnvio } = await criarClienteSemSessao().auth.signInWithOtp({
    email: pessoa.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origem}/auth/callback?seguinte=/definir-password`,
    },
  })

  if (erroEnvio) {
    // Nada de adivinhar a causa: a mensagem vem do erro real. A versão
    // anterior dizia sempre «o Supabase limita os emails por hora», e com o
    // SMTP mal configurado isso mandava esperar uma hora por um problema que
    // não passava sozinho.
    return { ok: false, mensagem: traduzirErroAutenticacao(erroEnvio) }
  }

  await supabase
    .from('pessoas')
    .update({ convidado_em: new Date().toISOString() })
    .eq('id', id)

  revalidatePath(`/pessoas/${id}`)
  revalidatePath('/pessoas')

  return {
    ok: true,
    mensagem: `Convite enviado para ${pessoa.email}.${
      pessoa.perfil ? '' : ' Sem perfil escolhido, entra como cliente.'
    }`,
  }
}
