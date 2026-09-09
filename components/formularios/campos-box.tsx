import { AreaTexto, Caixa, Campo, Entrada, Etiqueta, Selector } from '@/components/ui/campos'
import { GrelhaCampos } from '@/components/formulario-entidade'
import type { Box } from '@/lib/tipos-bd'

export function CamposBox({
  box,
  cavalosDisponiveis,
}: {
  box?: Box | null
  cavalosDisponiveis: { id: string; nome: string }[]
}) {
  return (
    <>
      <GrelhaCampos>
        <Campo etiqueta="Identificação" htmlFor="identificacao" obrigatorio>
          <Entrada
            id="identificacao"
            name="identificacao"
            defaultValue={box?.identificacao ?? ''}
            placeholder="A1"
            required
            autoFocus
            autoComplete="off"
          />
        </Campo>

        <Campo etiqueta="Zona" htmlFor="zona" ajuda="Ex.: Cavalariça A">
          <Entrada
            id="zona"
            name="zona"
            defaultValue={box?.zona ?? ''}
            autoComplete="off"
          />
        </Campo>

        <Campo
          etiqueta="Cavalo alojado"
          htmlFor="cavalo_id"
          ajuda="Só aparecem cavalos sem box atribuída."
          className="sm:col-span-2"
        >
          <Selector id="cavalo_id" name="cavalo_id" defaultValue={box?.cavalo_id ?? ''}>
            <option value="">— Box vazia —</option>
            {cavalosDisponiveis.map((cavalo) => (
              <option key={cavalo.id} value={cavalo.id}>
                {cavalo.nome}
              </option>
            ))}
          </Selector>
        </Campo>

        <div className="flex items-end pb-2">
          <Caixa
            id="activa"
            name="activa"
            etiqueta="Box em uso"
            defaultChecked={box?.activa ?? true}
          />
        </div>
      </GrelhaCampos>

      <div className="space-y-1.5">
        <Etiqueta htmlFor="notas">Notas</Etiqueta>
        <AreaTexto id="notas" name="notas" defaultValue={box?.notas ?? ''} />
      </div>
    </>
  )
}
