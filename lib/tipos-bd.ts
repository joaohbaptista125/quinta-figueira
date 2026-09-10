/**
 * Tipos da base de dados.
 *
 * Escritos à mão a espelhar supabase/migrations/. Quando existir um projecto
 * Supabase ligado, podem ser regenerados com:
 *
 *   npx supabase gen types typescript --project-id <ref> > lib/tipos-bd.ts
 *
 * Se alterares uma migração, actualiza este ficheiro na mesma alteração.
 */

export type SexoCavalo = 'macho' | 'femea' | 'castrado'
export type RegimeCavalo = 'penso' | 'escola' | 'centro'
export type PapelPessoa =
  | 'aluno'
  | 'proprietario'
  | 'instrutor'
  | 'tratador'
  | 'jogador_horseball'
export type PerfilAcesso = 'admin' | 'gestor' | 'instrutor' | 'tratador' | 'cliente'
export type MetodoPagamento =
  | 'dinheiro'
  | 'transferencia'
  | 'mbway'
  | 'multibanco'
  | 'cheque'
  | 'debito_directo'
export type TipoConta = 'caixa' | 'banco'
export type TipoRecebimento = 'penso' | 'aulas' | 'outro'
export type EstadoMensalidade = 'pendente' | 'paga' | 'anulada'
export type TipoEvento = 'aula' | 'treino_horseball' | 'competicao'
export type EstadoParticipacao =
  | 'convocado'
  | 'presente'
  | 'faltou'
  | 'dispensado'

type Carimbos = {
  criado_em: string
  actualizado_em: string
}

export type Pessoa = Carimbos & {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  nif: string | null
  morada: string | null
  notas: string | null
  activo: boolean
  auth_user_id: string | null
  perfil: PerfilAcesso | null
}

export type PessoaPapel = {
  pessoa_id: string
  papel: PapelPessoa
  criado_em: string
}

export type Cavalo = Carimbos & {
  id: string
  nome: string
  data_nascimento: string | null
  sexo: SexoCavalo | null
  raca: string | null
  pelagem: string | null
  num_passaporte: string | null
  microchip: string | null
  foto_path: string | null
  regime: RegimeCavalo
  proprietario_id: string | null
  activo: boolean
  notas: string | null
}

export type Box = Carimbos & {
  id: string
  identificacao: string
  zona: string | null
  cavalo_id: string | null
  activa: boolean
  notas: string | null
}

export type ContratoPenso = Carimbos & {
  id: string
  cavalo_id: string
  cliente_id: string
  valor_mensal: number
  dia_vencimento: number
  data_inicio: string
  data_fim: string | null
  notas: string | null
}

export type Conta = Carimbos & {
  id: string
  nome: string
  tipo: TipoConta
  iban: string | null
  saldo_inicial: number
  activa: boolean
  notas: string | null
}

export type CategoriaDespesa = Carimbos & {
  id: string
  nome: string
  slug: string
  ordem: number
  activa: boolean
}

export type Fornecedor = Carimbos & {
  id: string
  nome: string
  nif: string | null
  email: string | null
  telefone: string | null
  morada: string | null
  activo: boolean
  notas: string | null
}

export type Despesa = Carimbos & {
  id: string
  data: string
  categoria_id: string
  fornecedor_id: string | null
  descricao: string
  valor_total: number
  taxa_iva: number
  /** Coluna calculada — não enviar em INSERT/UPDATE. */
  valor_base: number
  /** Coluna calculada — não enviar em INSERT/UPDATE. */
  valor_iva: number
  metodo_pagamento: MetodoPagamento
  conta_id: string
  paga: boolean
  data_pagamento: string | null
  cavalo_id: string | null
  anexo_path: string | null
  notas: string | null
  criado_por: string | null
}

export type MensalidadePenso = Carimbos & {
  id: string
  contrato_id: string
  periodo: string
  valor: number
  estado: EstadoMensalidade
  notas: string | null
}

export type Recebimento = Carimbos & {
  id: string
  data: string
  pessoa_id: string
  valor: number
  metodo_pagamento: MetodoPagamento
  conta_id: string
  tipo: TipoRecebimento
  mensalidade_id: string | null
  periodo: string | null
  descricao: string | null
  notas: string | null
  /** Referência de documento emitido em software certificado pela AT. */
  documento_fiscal_ref: string | null
  documento_fiscal_url: string | null
  documento_fiscal_emitido_em: string | null
  criado_por: string | null
}

export type Equipa = Carimbos & {
  id: string
  nome: string
  escalao: string | null
  notas: string | null
  activa: boolean
}

export type EquipaMembro = {
  equipa_id: string
  pessoa_id: string
  criado_em: string
}

export type Evento = Carimbos & {
  id: string
  tipo: TipoEvento
  titulo: string | null
  data: string
  /** 'HH:MM:SS' */
  hora_inicio: string
  hora_fim: string | null
  local: string | null
  responsavel_id: string | null
  equipa_id: string | null
  notas: string | null
  cancelado: boolean
  motivo_cancelamento: string | null
  /** Gancho da Fase 4. */
  recebimento_id: string | null
  criado_por: string | null
}

export type EventoParticipante = Carimbos & {
  id: string
  evento_id: string
  pessoa_id: string
  cavalo_id: string | null
  estado: EstadoParticipacao
  notas: string | null
  /** Mantido por trigger — nunca escrever. */
  periodo: string | null
}

export type Aviso = Carimbos & {
  id: string
  evento_id: string | null
  equipa_id: string | null
  texto: string
  autor_id: string | null
  criado_por: string | null
}

export type Calendario = {
  pessoa_id: string
  token: string
  criado_em: string
}

/** Uma linha da agenda_por_token(), para o ficheiro iCal. */
export type LinhaAgenda = {
  id: string
  tipo: TipoEvento
  titulo: string | null
  data: string
  hora_inicio: string
  hora_fim: string | null
  local: string | null
  cancelado: boolean
  responsavel: string | null
  cavalo: string | null
  notas: string | null
  avisos: string | null
  actualizado_em: string
}

export type SaldoConta = {
  id: string
  nome: string
  tipo: TipoConta
  iban: string | null
  activa: boolean
  saldo_inicial: number
  total_recebido: number
  total_despesas_pagas: number
  saldo_actual: number
}

export type ResumoMensal = {
  periodo: string
  total_recebimentos: number
  total_despesas: number
  total_despesas_pagas: number
  resultado: number
}

export type DespesaPorCategoria = {
  periodo: string
  categoria_id: string
  categoria_nome: string
  categoria_slug: string
  categoria_ordem: number
  num_despesas: number
  total: number
}

export type PensoPorReceber = {
  mensalidade_id: string
  periodo: string
  valor: number
  estado: EstadoMensalidade
  contrato_id: string
  dia_vencimento: number
  cavalo_id: string
  cavalo_nome: string
  cliente_id: string
  cliente_nome: string
  cliente_telefone: string | null
  cliente_email: string | null
  valor_pago: number
  valor_em_falta: number
}

/** Colunas geradas pela base de dados, nunca enviadas em escrita. */
type SoLeitura = 'id' | 'criado_em' | 'actualizado_em'

type Insercao<T, Obrigatorios extends keyof T = never> = Omit<T, SoLeitura> &
  Partial<Pick<T, Extract<SoLeitura, keyof T>>> &
  Required<Pick<T, Obrigatorios>>

type Relacao<
  Coluna extends string,
  Destino extends string,
  UmParaUm extends boolean = false,
> = {
  foreignKeyName: string
  columns: [Coluna]
  isOneToOne: UmParaUm
  referencedRelation: Destino
  referencedColumns: ['id']
}

type Tabela<
  Linha,
  Ins = Partial<Insercao<Linha>>,
  Rel extends readonly unknown[] = [],
> = {
  Row: Linha
  Insert: Ins
  Update: Partial<Ins>
  Relationships: Rel
}

type Vista<Linha> = {
  Row: Linha
  Relationships: []
}

export type BaseDados = {
  public: {
    Tables: {
      pessoas: Tabela<Pessoa, Partial<Omit<Pessoa, SoLeitura>> & { nome: string }>
      pessoa_papeis: Tabela<
        PessoaPapel,
        { pessoa_id: string; papel: PapelPessoa },
        [Relacao<'pessoa_id', 'pessoas'>]
      >
      cavalos: Tabela<
        Cavalo,
        Partial<Omit<Cavalo, SoLeitura>> & { nome: string; regime: RegimeCavalo },
        [Relacao<'proprietario_id', 'pessoas'>]
      >
      boxes: Tabela<
        Box,
        Partial<Omit<Box, SoLeitura>> & { identificacao: string },
        [Relacao<'cavalo_id', 'cavalos', true>]
      >
      contratos_penso: Tabela<
        ContratoPenso,
        Partial<Omit<ContratoPenso, SoLeitura>> & {
          cavalo_id: string
          cliente_id: string
          valor_mensal: number
          data_inicio: string
        },
        [Relacao<'cavalo_id', 'cavalos'>, Relacao<'cliente_id', 'pessoas'>]
      >
      contas: Tabela<
        Conta,
        Partial<Omit<Conta, SoLeitura>> & { nome: string; tipo: TipoConta }
      >
      categorias_despesa: Tabela<
        CategoriaDespesa,
        Partial<Omit<CategoriaDespesa, SoLeitura>> & { nome: string; slug: string }
      >
      fornecedores: Tabela<
        Fornecedor,
        Partial<Omit<Fornecedor, SoLeitura>> & { nome: string }
      >
      despesas: Tabela<
        Despesa,
        Partial<Omit<Despesa, SoLeitura | 'valor_base' | 'valor_iva'>> & {
          categoria_id: string
          descricao: string
          valor_total: number
          metodo_pagamento: MetodoPagamento
          conta_id: string
        },
        [
          Relacao<'categoria_id', 'categorias_despesa'>,
          Relacao<'fornecedor_id', 'fornecedores'>,
          Relacao<'conta_id', 'contas'>,
          Relacao<'cavalo_id', 'cavalos'>,
        ]
      >
      mensalidades_penso: Tabela<
        MensalidadePenso,
        Partial<Omit<MensalidadePenso, SoLeitura>> & {
          contrato_id: string
          periodo: string
          valor: number
        },
        [Relacao<'contrato_id', 'contratos_penso'>]
      >
      recebimentos: Tabela<
        Recebimento,
        Partial<Omit<Recebimento, SoLeitura>> & {
          pessoa_id: string
          valor: number
          metodo_pagamento: MetodoPagamento
          conta_id: string
          tipo: TipoRecebimento
        },
        [
          Relacao<'pessoa_id', 'pessoas'>,
          Relacao<'conta_id', 'contas'>,
          Relacao<'mensalidade_id', 'mensalidades_penso'>,
        ]
      >
      equipas: Tabela<
        Equipa,
        Partial<Omit<Equipa, SoLeitura>> & { nome: string }
      >
      equipa_membros: Tabela<
        EquipaMembro,
        { equipa_id: string; pessoa_id: string },
        [Relacao<'equipa_id', 'equipas'>, Relacao<'pessoa_id', 'pessoas'>]
      >
      eventos: Tabela<
        Evento,
        Partial<Omit<Evento, SoLeitura>> & {
          tipo: TipoEvento
          data: string
          hora_inicio: string
        },
        [
          Relacao<'responsavel_id', 'pessoas'>,
          Relacao<'equipa_id', 'equipas'>,
          Relacao<'recebimento_id', 'recebimentos'>,
        ]
      >
      evento_participantes: Tabela<
        EventoParticipante,
        Partial<Omit<EventoParticipante, SoLeitura | 'periodo'>> & {
          evento_id: string
          pessoa_id: string
        },
        [
          Relacao<'evento_id', 'eventos'>,
          Relacao<'pessoa_id', 'pessoas'>,
          Relacao<'cavalo_id', 'cavalos'>,
        ]
      >
      avisos: Tabela<
        Aviso,
        Partial<Omit<Aviso, SoLeitura>> & { texto: string },
        [
          Relacao<'evento_id', 'eventos'>,
          Relacao<'equipa_id', 'equipas'>,
          Relacao<'autor_id', 'pessoas'>,
        ]
      >
      calendarios: Tabela<
        Calendario,
        { pessoa_id: string },
        [Relacao<'pessoa_id', 'pessoas'>]
      >
    }
    Views: {
      v_saldos_contas: Vista<SaldoConta>
      v_resumo_mensal: Vista<ResumoMensal>
      v_despesas_por_categoria: Vista<DespesaPorCategoria>
      v_pensos_por_receber: Vista<PensoPorReceber>
    }
    Functions: {
      gerar_mensalidades: { Args: { p_periodo: string }; Returns: number }
      reclamar_primeiro_admin: { Args: { p_nome: string }; Returns: string }
      existe_admin: { Args: Record<string, never>; Returns: boolean }
      e_gestao: { Args: Record<string, never>; Returns: boolean }
      e_equipa: { Args: Record<string, never>; Returns: boolean }
      e_admin: { Args: Record<string, never>; Returns: boolean }
      perfil_actual: { Args: Record<string, never>; Returns: PerfilAcesso | null }
      pessoa_actual_id: { Args: Record<string, never>; Returns: string | null }
      e_instrutor_ou_gestao: { Args: Record<string, never>; Returns: boolean }
      participo_no_evento: { Args: { p_evento: string }; Returns: boolean }
      sou_membro_da_equipa: { Args: { p_equipa: string }; Returns: boolean }
      obter_token_calendario: { Args: { p_renovar?: boolean }; Returns: string }
      agenda_por_token: { Args: { p_token: string }; Returns: LinhaAgenda[] }
    }
    Enums: {
      sexo_cavalo: SexoCavalo
      regime_cavalo: RegimeCavalo
      papel_pessoa: PapelPessoa
      perfil_acesso: PerfilAcesso
      metodo_pagamento: MetodoPagamento
      tipo_conta: TipoConta
      tipo_recebimento: TipoRecebimento
      estado_mensalidade: EstadoMensalidade
      tipo_evento: TipoEvento
      estado_participacao: EstadoParticipacao
    }
    CompositeTypes: Record<string, never>
  }
}
