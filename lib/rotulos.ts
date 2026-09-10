/**
 * Rótulos em português de Portugal para os tipos enumerados da base de dados.
 * A base guarda o valor técnico; a interface mostra sempre estes rótulos.
 */

import type {
  EstadoMensalidade,
  EstadoParticipacao,
  TipoEvento,
  MetodoPagamento,
  PapelPessoa,
  PerfilAcesso,
  RegimeCavalo,
  SexoCavalo,
  TipoConta,
  TipoRecebimento,
} from './tipos-bd'

export const ROTULOS_SEXO: Record<SexoCavalo, string> = {
  macho: 'Macho',
  femea: 'Fêmea',
  castrado: 'Castrado',
}

export const ROTULOS_REGIME: Record<RegimeCavalo, string> = {
  penso: 'A penso',
  escola: 'Da escola',
  centro: 'Propriedade do centro',
}

export const ROTULOS_PAPEL: Record<PapelPessoa, string> = {
  aluno: 'Aluno',
  proprietario: 'Proprietário',
  instrutor: 'Instrutor',
  tratador: 'Tratador',
  jogador_horseball: 'Jogador de Horseball',
}

export const ROTULOS_PERFIL: Record<PerfilAcesso, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  instrutor: 'Instrutor',
  tratador: 'Tratador',
  cliente: 'Cliente',
}

export const ROTULOS_METODO: Record<MetodoPagamento, string> = {
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  mbway: 'MB Way',
  multibanco: 'Multibanco',
  cheque: 'Cheque',
  debito_directo: 'Débito directo',
}

export const ROTULOS_TIPO_CONTA: Record<TipoConta, string> = {
  caixa: 'Caixa',
  banco: 'Banco',
}

export const ROTULOS_TIPO_RECEBIMENTO: Record<TipoRecebimento, string> = {
  penso: 'Penso',
  aulas: 'Aulas',
  outro: 'Outro',
}

export const ROTULOS_ESTADO_MENSALIDADE: Record<EstadoMensalidade, string> = {
  pendente: 'Pendente',
  paga: 'Paga',
  anulada: 'Anulada',
}

export const ROTULOS_TIPO_EVENTO: Record<TipoEvento, string> = {
  aula: 'Aula',
  treino_horseball: 'Treino de Horseball',
  competicao: 'Competição',
}

/** Versão curta, para caber nas pastilhas do quadro do dia. */
export const ROTULOS_TIPO_EVENTO_CURTO: Record<TipoEvento, string> = {
  aula: 'Aula',
  treino_horseball: 'Horseball',
  competicao: 'Competição',
}

export const ROTULOS_ESTADO_PARTICIPACAO: Record<EstadoParticipacao, string> = {
  convocado: 'Convocado',
  presente: 'Presente',
  faltou: 'Faltou',
  dispensado: 'Dispensado',
}

/** Taxas de IVA em vigor no continente. */
export const TAXAS_IVA = [
  { valor: 23, rotulo: '23% (normal)' },
  { valor: 13, rotulo: '13% (intermédia)' },
  { valor: 6, rotulo: '6% (reduzida)' },
  { valor: 0, rotulo: 'Isento / sem IVA' },
]

/** Converte um Record de rótulos numa lista pronta para <select>. */
export function paraOpcoes<T extends string>(
  rotulos: Record<T, string>,
): { valor: T; rotulo: string }[] {
  return (Object.keys(rotulos) as T[]).map((valor) => ({
    valor,
    rotulo: rotulos[valor],
  }))
}
