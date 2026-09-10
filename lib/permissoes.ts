import type { PerfilAcesso } from './tipos-bd'

/**
 * Espelho, em TypeScript, das funções e_gestao()/e_equipa() da base de dados.
 * Servem só para decidir o que mostrar: a protecção real é a RLS.
 */

export function eGestao(perfil: PerfilAcesso | null | undefined) {
  return perfil === 'admin' || perfil === 'gestor'
}

export function eEquipa(perfil: PerfilAcesso | null | undefined) {
  return (
    perfil === 'admin' ||
    perfil === 'gestor' ||
    perfil === 'instrutor' ||
    perfil === 'tratador'
  )
}

/** Quem planeia o dia: gestão e instrutores. Espelha e_instrutor_ou_gestao(). */
export function eInstrutorOuGestao(perfil: PerfilAcesso | null | undefined) {
  return perfil === 'admin' || perfil === 'gestor' || perfil === 'instrutor'
}

export function eAdmin(perfil: PerfilAcesso | null | undefined) {
  return perfil === 'admin'
}
