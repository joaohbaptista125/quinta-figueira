import { AreaTexto, Caixa, Campo, Entrada, Etiqueta, Selector } from '@/components/ui/campos'
import { GrelhaCampos } from '@/components/formulario-entidade'
import { ROTULOS_METODO, TAXAS_IVA, paraOpcoes } from '@/lib/rotulos'
import { hoje } from '@/lib/formatos'
import type { Despesa } from '@/lib/tipos-bd'

export function CamposDespesa({
  despesa,
  categorias,
  fornecedores,
  contas,
  cavalos,
}: {
  despesa?: Despesa | null
  categorias: { id: string; nome: string }[]
  fornecedores: { id: string; nome: string }[]
  contas: { id: string; nome: string }[]
  cavalos: { id: string; nome: string }[]
}) {
  return (
    <>
      <GrelhaCampos>
        <Campo etiqueta="Data" htmlFor="data" obrigatorio>
          <Entrada
            id="data"
            name="data"
            type="date"
            defaultValue={despesa?.data ?? hoje()}
            required
          />
        </Campo>

        <Campo etiqueta="Categoria" htmlFor="categoria_id" obrigatorio>
          <Selector
            id="categoria_id"
            name="categoria_id"
            defaultValue={despesa?.categoria_id ?? ''}
            required
          >
            <option value="">— Escolher —</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </Selector>
        </Campo>

        <Campo
          etiqueta="Descrição"
          htmlFor="descricao"
          obrigatorio
          className="sm:col-span-2"
        >
          <Entrada
            id="descricao"
            name="descricao"
            defaultValue={despesa?.descricao ?? ''}
            placeholder="Ração — 20 sacos"
            required
            autoFocus
            autoComplete="off"
          />
        </Campo>

        <Campo
          etiqueta="Valor total (€)"
          htmlFor="valor_total"
          obrigatorio
          ajuda="O que sai da conta, com IVA incluído — tal como vem no talão."
        >
          <Entrada
            id="valor_total"
            name="valor_total"
            inputMode="decimal"
            defaultValue={despesa?.valor_total ?? ''}
            placeholder="738,00"
            required
            autoComplete="off"
          />
        </Campo>

        <Campo etiqueta="Taxa de IVA" htmlFor="taxa_iva">
          <Selector
            id="taxa_iva"
            name="taxa_iva"
            defaultValue={String(despesa?.taxa_iva ?? 23)}
          >
            {TAXAS_IVA.map((taxa) => (
              <option key={taxa.valor} value={taxa.valor}>
                {taxa.rotulo}
              </option>
            ))}
          </Selector>
        </Campo>

        <Campo etiqueta="Método de pagamento" htmlFor="metodo_pagamento" obrigatorio>
          <Selector
            id="metodo_pagamento"
            name="metodo_pagamento"
            defaultValue={despesa?.metodo_pagamento ?? 'transferencia'}
            required
          >
            {paraOpcoes(ROTULOS_METODO).map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Selector>
        </Campo>

        <Campo etiqueta="Conta de origem" htmlFor="conta_id" obrigatorio>
          <Selector
            id="conta_id"
            name="conta_id"
            defaultValue={despesa?.conta_id ?? ''}
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

        <Campo etiqueta="Fornecedor" htmlFor="fornecedor_id">
          <Selector
            id="fornecedor_id"
            name="fornecedor_id"
            defaultValue={despesa?.fornecedor_id ?? ''}
          >
            <option value="">— Sem fornecedor —</option>
            {fornecedores.map((fornecedor) => (
              <option key={fornecedor.id} value={fornecedor.id}>
                {fornecedor.nome}
              </option>
            ))}
          </Selector>
        </Campo>

        <Campo
          etiqueta="Imputar ao cavalo"
          htmlFor="cavalo_id"
          ajuda="Opcional. Útil em veterinário e ferrador."
        >
          <Selector
            id="cavalo_id"
            name="cavalo_id"
            defaultValue={despesa?.cavalo_id ?? ''}
          >
            <option value="">— Despesa do centro —</option>
            {cavalos.map((cavalo) => (
              <option key={cavalo.id} value={cavalo.id}>
                {cavalo.nome}
              </option>
            ))}
          </Selector>
        </Campo>

        <Campo
          etiqueta="Fatura digitalizada"
          htmlFor="anexo"
          ajuda="PDF ou fotografia, até 20 MB."
        >
          <Entrada
            id="anexo"
            name="anexo"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
            className="h-auto py-1.5 file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
          />
        </Campo>

        <div className="flex items-end pb-2">
          <Caixa
            id="paga"
            name="paga"
            etiqueta="Já foi paga"
            defaultChecked={despesa?.paga ?? true}
          />
        </div>
      </GrelhaCampos>

      <div className="space-y-1.5">
        <Etiqueta htmlFor="notas">Notas</Etiqueta>
        <AreaTexto id="notas" name="notas" defaultValue={despesa?.notas ?? ''} />
      </div>
    </>
  )
}
