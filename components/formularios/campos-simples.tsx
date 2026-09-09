import { AreaTexto, Caixa, Campo, Entrada, Etiqueta, Selector } from '@/components/ui/campos'
import { GrelhaCampos } from '@/components/formulario-entidade'
import { ROTULOS_TIPO_CONTA, paraOpcoes } from '@/lib/rotulos'
import type { CategoriaDespesa, Conta, Fornecedor } from '@/lib/tipos-bd'

export function CamposConta({ conta }: { conta?: Conta | null }) {
  return (
    <>
      <GrelhaCampos>
        <Campo
          etiqueta="Nome"
          htmlFor="nome"
          obrigatorio
          ajuda="Ex.: «Caixa» ou «CGD ...1234»"
        >
          <Entrada
            id="nome"
            name="nome"
            defaultValue={conta?.nome ?? ''}
            required
            autoFocus
            autoComplete="off"
          />
        </Campo>

        <Campo etiqueta="Tipo" htmlFor="tipo" obrigatorio>
          <Selector id="tipo" name="tipo" defaultValue={conta?.tipo ?? 'banco'} required>
            {paraOpcoes(ROTULOS_TIPO_CONTA).map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Selector>
        </Campo>

        <Campo etiqueta="IBAN" htmlFor="iban" ajuda="Só para contas bancárias.">
          <Entrada
            id="iban"
            name="iban"
            defaultValue={conta?.iban ?? ''}
            autoComplete="off"
          />
        </Campo>

        <Campo
          etiqueta="Saldo inicial (€)"
          htmlFor="saldo_inicial"
          ajuda="Saldo à data em que se começou a usar a aplicação."
        >
          <Entrada
            id="saldo_inicial"
            name="saldo_inicial"
            inputMode="decimal"
            defaultValue={conta?.saldo_inicial ?? '0'}
            autoComplete="off"
          />
        </Campo>

        <div className="flex items-end pb-2">
          <Caixa
            id="activa"
            name="activa"
            etiqueta="Conta activa"
            defaultChecked={conta?.activa ?? true}
          />
        </div>
      </GrelhaCampos>

      <div className="space-y-1.5">
        <Etiqueta htmlFor="notas">Notas</Etiqueta>
        <AreaTexto id="notas" name="notas" defaultValue={conta?.notas ?? ''} />
      </div>
    </>
  )
}

export function CamposFornecedor({ fornecedor }: { fornecedor?: Fornecedor | null }) {
  return (
    <>
      <GrelhaCampos>
        <Campo etiqueta="Nome" htmlFor="nome" obrigatorio className="sm:col-span-2">
          <Entrada
            id="nome"
            name="nome"
            defaultValue={fornecedor?.nome ?? ''}
            required
            autoFocus
            autoComplete="off"
          />
        </Campo>

        <Campo etiqueta="NIF" htmlFor="nif" ajuda="9 dígitos">
          <Entrada
            id="nif"
            name="nif"
            inputMode="numeric"
            pattern="[0-9]{9}"
            maxLength={9}
            defaultValue={fornecedor?.nif ?? ''}
            autoComplete="off"
          />
        </Campo>

        <Campo etiqueta="Telefone" htmlFor="telefone">
          <Entrada
            id="telefone"
            name="telefone"
            type="tel"
            defaultValue={fornecedor?.telefone ?? ''}
            autoComplete="off"
          />
        </Campo>

        <Campo etiqueta="Email" htmlFor="email">
          <Entrada
            id="email"
            name="email"
            type="email"
            defaultValue={fornecedor?.email ?? ''}
            autoComplete="off"
          />
        </Campo>

        <Campo etiqueta="Morada" htmlFor="morada">
          <Entrada
            id="morada"
            name="morada"
            defaultValue={fornecedor?.morada ?? ''}
            autoComplete="off"
          />
        </Campo>

        <div className="flex items-end pb-2">
          <Caixa
            id="activo"
            name="activo"
            etiqueta="Fornecedor activo"
            defaultChecked={fornecedor?.activo ?? true}
          />
        </div>
      </GrelhaCampos>

      <div className="space-y-1.5">
        <Etiqueta htmlFor="notas">Notas</Etiqueta>
        <AreaTexto id="notas" name="notas" defaultValue={fornecedor?.notas ?? ''} />
      </div>
    </>
  )
}

export function CamposCategoria({
  categoria,
}: {
  categoria?: CategoriaDespesa | null
}) {
  return (
    <GrelhaCampos>
      <Campo etiqueta="Nome" htmlFor="nome" obrigatorio>
        <Entrada
          id="nome"
          name="nome"
          defaultValue={categoria?.nome ?? ''}
          required
          autoFocus
          autoComplete="off"
        />
      </Campo>

      <Campo
        etiqueta="Ordem"
        htmlFor="ordem"
        ajuda="Menor aparece primeiro nas listas."
      >
        <Entrada
          id="ordem"
          name="ordem"
          type="number"
          defaultValue={categoria?.ordem ?? 100}
        />
      </Campo>

      <div className="flex items-end pb-2">
        <Caixa
          id="activa"
          name="activa"
          etiqueta="Categoria activa"
          defaultChecked={categoria?.activa ?? true}
        />
      </div>
    </GrelhaCampos>
  )
}
