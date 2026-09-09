import { AreaTexto, Campo, Entrada, Etiqueta, Selector } from '@/components/ui/campos'
import { GrelhaCampos } from '@/components/formulario-entidade'
import { hoje } from '@/lib/formatos'
import type { ContratoPenso } from '@/lib/tipos-bd'

export function CamposContrato({
  contrato,
  cavalos,
  clientes,
  cavaloPreSeleccionado,
}: {
  contrato?: ContratoPenso | null
  cavalos: { id: string; nome: string }[]
  clientes: { id: string; nome: string }[]
  cavaloPreSeleccionado?: string
}) {
  return (
    <>
      <GrelhaCampos>
        <Campo etiqueta="Cavalo" htmlFor="cavalo_id" obrigatorio>
          <Selector
            id="cavalo_id"
            name="cavalo_id"
            defaultValue={contrato?.cavalo_id ?? cavaloPreSeleccionado ?? ''}
            required
            autoFocus
          >
            <option value="">— Escolher —</option>
            {cavalos.map((cavalo) => (
              <option key={cavalo.id} value={cavalo.id}>
                {cavalo.nome}
              </option>
            ))}
          </Selector>
        </Campo>

        <Campo etiqueta="Cliente" htmlFor="cliente_id" obrigatorio>
          <Selector
            id="cliente_id"
            name="cliente_id"
            defaultValue={contrato?.cliente_id ?? ''}
            required
          >
            <option value="">— Escolher —</option>
            {clientes.map((pessoa) => (
              <option key={pessoa.id} value={pessoa.id}>
                {pessoa.nome}
              </option>
            ))}
          </Selector>
        </Campo>

        <Campo etiqueta="Valor mensal (€)" htmlFor="valor_mensal" obrigatorio>
          <Entrada
            id="valor_mensal"
            name="valor_mensal"
            inputMode="decimal"
            defaultValue={contrato?.valor_mensal ?? ''}
            placeholder="280,00"
            required
            autoComplete="off"
          />
        </Campo>

        <Campo
          etiqueta="Dia de vencimento"
          htmlFor="dia_vencimento"
          ajuda="Entre 1 e 28, para existir em todos os meses."
        >
          <Entrada
            id="dia_vencimento"
            name="dia_vencimento"
            type="number"
            min={1}
            max={28}
            defaultValue={contrato?.dia_vencimento ?? 1}
          />
        </Campo>

        <Campo etiqueta="Data de início" htmlFor="data_inicio" obrigatorio>
          <Entrada
            id="data_inicio"
            name="data_inicio"
            type="date"
            defaultValue={contrato?.data_inicio ?? hoje()}
            required
          />
        </Campo>

        <Campo
          etiqueta="Data de fim"
          htmlFor="data_fim"
          ajuda="Deixe em branco enquanto o contrato estiver em vigor."
        >
          <Entrada
            id="data_fim"
            name="data_fim"
            type="date"
            defaultValue={contrato?.data_fim ?? ''}
          />
        </Campo>
      </GrelhaCampos>

      <div className="space-y-1.5">
        <Etiqueta htmlFor="notas">Notas</Etiqueta>
        <AreaTexto id="notas" name="notas" defaultValue={contrato?.notas ?? ''} />
      </div>
    </>
  )
}
