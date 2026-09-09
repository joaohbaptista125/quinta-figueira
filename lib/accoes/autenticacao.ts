'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { obterOrigem } from '@/lib/sessao'
import type { ResultadoAccao } from './resultado'

function texto(dados: FormData, campo: string) {
  const valor = dados.get(campo)
  return typeof valor === 'string' ? valor.trim() : ''
}

export async function entrar(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const email = texto(dados, 'email')
  const password = texto(dados, 'password')
  const seguinte = texto(dados, 'seguinte') || '/'

  if (!email || !password) {
    return { ok: false, mensagem: 'Indique o email e a palavra-passe.' }
  }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Mensagem deliberadamente vaga: não revela se o email existe.
    return { ok: false, mensagem: 'Email ou palavra-passe incorrectos.' }
  }

  revalidatePath('/', 'layout')
  redirect(seguinte.startsWith('/') ? seguinte : '/')
}

export async function pedirRecuperacao(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const email = texto(dados, 'email')
  if (!email) return { ok: false, mensagem: 'Indique o seu email.' }

  const supabase = await criarClienteServidor()
  const origem = await obterOrigem()

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origem}/auth/callback?seguinte=/definir-password`,
  })

  // Resposta igual exista ou não a conta, para não expor quem está registado.
  return {
    ok: true,
    mensagem:
      'Se este email tiver conta, receberá em breve uma mensagem com as instruções.',
  }
}

export async function definirPassword(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const password = texto(dados, 'password')
  const confirmacao = texto(dados, 'confirmacao')

  if (password.length < 8) {
    return {
      ok: false,
      mensagem: 'A palavra-passe tem de ter pelo menos 8 caracteres.',
    }
  }
  if (password !== confirmacao) {
    return { ok: false, mensagem: 'As duas palavras-passe não coincidem.' }
  }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return {
      ok: false,
      mensagem:
        'Não foi possível definir a palavra-passe. O link pode ter expirado — peça um novo.',
    }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function sair() {
  const supabase = await criarClienteServidor()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/entrar')
}

/**
 * Cria a primeira conta de administrador. Só funciona enquanto não existir
 * nenhum admin — sem isto o sistema ficaria trancado, porque escrever exige
 * perfil de gestão e no arranque ninguém o tem.
 */
export async function reclamarPrimeiroAdmin(
  _anterior: ResultadoAccao,
  dados: FormData,
): Promise<ResultadoAccao> {
  const nome = texto(dados, 'nome')
  if (!nome) return { ok: false, mensagem: 'Indique o seu nome.' }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.rpc('reclamar_primeiro_admin', {
    p_nome: nome,
  })

  if (error) return { ok: false, mensagem: error.message }

  revalidatePath('/', 'layout')
  redirect('/')
}
