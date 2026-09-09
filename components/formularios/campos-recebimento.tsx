import { AreaTexto, Campo, Entrada, Etiqueta, Selector } from '@/components/ui/campos'
import { GrelhaCampos } from '@/components/formulario-entidade'
import { Aviso } from '@/components/ui/superficie'
import { ROTULOS_METODO, ROTULOS_TIPO_RECEBIMENTO, paraOpcoes } from '@/lib/rotulos'
import { formatarEuros, formatarMesCapitalizado, hoje, primeiroDiaDoMes } from '@/lib/formatos'
import type { Recebimento } from '@/lib/tipos-bd'

export type OpcaoMensalidade = {
  mensalidade_id: string
  periodo: string
  cliente_id: string
  cliente_nome: string
  cavalo_nome: string
  valor_em_falta: number
}

export function CamposRecebimento({
  recebimento,
  pessoas,
  contas,
  mensalidades,
  mensalidadePreSeleccionada,
}: {
  recebimento?: Recebimento | null
  pessoas: { id: string; nome: string }[]
  contas: { id: string; nome: string }[]
  mensalidades: OpcaoMensalidade[]
  mensalidadePreSeleccionada?: OpcaoMensalidade
}) {
  const periodoPorOmissao =
    recebimento?.periodo?.slice(0, 7) ??
    mensalidadePreSeleccionada?.periodo.slice(0, 7) ??
    primeiroDiaDoMes().slice(0, 7)

  return (
    <>
      <GrelhaCampos>
        <Campo etiqueta="Data" htmlFor="data" obrigatorio>
          <Entrada
            id="data"
            name="data"
            type="date"
            defaultValue={recebimento?.data ?? hoje()}
            required
          />
        </Campo>

        <Campo etiqueta="Pessoa" htmlFor="pessoa_id" obrigatorio>
          <Selector
            id="pessoa_id"
            name="pessoa_id"
            defaultValue={
              recebimento?.pessoa_id ?? mensalidadePreSeleccionada?.cliente_id ?? ''
            }
            required
            autoFocus
          >
            <option value="">— Escolher —</option>
            {pessoas.map((pessoa) => (
              <option key={pessoa.id} value={pessoa.id}>
                {pessoa.nome}
              </option>
            ))}
          </Selector>
        </Campo>

        <Campo etiqueta="Valor (€)" htmlFor="valor" obrigatorio>
          <Entrada
            id="valor"
            name="valor"
            inputMode="decimal"
            defaultValue={
              recebimento?.valor ?? mensalidadePreSeleccionada?.valor_em_falta ?? ''
            }
            placeholder="280,00"
            required
            autoComplete="off"
          />
        </Campo>

        <Campo etiqueta="Refere-se a" htmlFor="tipo" obrigatorio>
          <Selector
            id="tipo"
            name="tipo"
            defaultValue={
              recebimento?.tipo ?? (mensalidadePreSeleccionada ? 'penso' : 'penso')
            }
            required
          >
            {paraOpcoes(ROTULOS_TIPO_RECEBIMENTO).map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Selector>
        </Campo>

        <Campo etiqueta="Método de pagamento" htmlFor="metodo_pagamento" obrigatorio>
          <Selector
            id="metodo_pagamento"
            name="metodo_pagamento"
            defaultValue={recebimento?.metodo_pagamento ?? 'transferencia'}
            required
          >
            {paraOpcoes(ROTULOS_METODO).map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Selector>
        </Campo>

        <Campo etiqueta="Conta de destino" htmlFor="conta_id" obrigatorio>
          <Selector
            id="conta_id"
            name="conta_id"
            defaultValue={recebimento?.conta_id ?? ''}
            required
          >
            <option value="">— Escolher —</option>
            {contas.map((conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.nome}
              </option>
            ))}
          </Selector>
        </Campo>

        <Campo
          etiqueta="Mês a que respeita"
          htmlFor="periodo"
          ajuda="Usado nos relatórios mensais."
        >
          <Entrada
            id="periodo"
            name="periodo"
            type="month"
            defaultValue={periodoPorOmissao}
          />
        </Campo>

        <Campo
          etiqueta="Mensalidade de penso"
          htmlFor="mensalidade_id"
          ajuda="Só se aplica a recebimentos de penso. Ao ficar liquidada, a mensalidade passa sozinha a paga."
        >
          <Selector
            id="mensalidade_id"
            name="mensalidade_id"
            defaultValue={
              recebimento?.mensalidade_id ??
              mensalidadePreSeleccionada?.mensalidade_id ??
              ''
            }
          >
            <option value="">— Não imputar a nenhuma —</option>
            {mensalidades.map((mensalidade) => (
              <option key={mensalidade.mensalidade_id} value={mensalidade.mensalidade_id}>
                {formatarMesCapitalizado(mensalidade.periodo)} ·{' '}
                {mensalidade.cliente_nome} · {mensalidade.cavalo_nome} ·{' '}
                {formatarEuros(mensalidade.valor_em_falta)} em falta
              </option>
            ))}
          </Selector>
        </Campo>

        <Campo etiqueta="Descrição" htmlFor="descricao" className="sm:col-span-2">
          <Entrada
            id="descricao"
            name="descricao"
            defaultValue={recebimento?.descricao ?? ''}
            placeholder="Penso de Setembro"
            autoComplete="off"
          />
        </Campo>

        <Campo
          etiqueta="Referência do documento fiscal"
          htmlFor="documento_fiscal_ref"
          ajuda="Número do recibo emitido no software certificado (Vendus, InvoiceXpress, Moloni). Esta aplicação não emite documentos fiscais."
          className="sm:col-span-2"
        >
          <Entrada
            id="documento_fiscal_ref"
            name="documento_fiscal_ref"
            defaultValue={recebimento?.documento_fiscal_ref ?? ''}
            placeholder="FR 2026/123"
            autoComplete="off"
          />
        </Campo>
      </GrelhaCampos>

      <Aviso tom="info">
        Este registo serve a gestão interna do centro. O recibo com valor fiscal
        continua a ser emitido no software certificado pela AT.
      </Aviso>

      <div className="space-y-1.5">
        <Etiqueta htmlFor="notas">Notas</Etiqueta>
        <AreaTexto id="notas" name="notas" defaultValue={recebimento?.notas ?? ''} />
      </div>
    </>
  )
}
