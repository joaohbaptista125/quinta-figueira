import { AreaTexto, Caixa, Campo, Entrada, Etiqueta } from '@/components/ui/campos'
import { GrelhaCampos } from '@/components/formulario-entidade'
import type { Equipa } from '@/lib/tipos-bd'

export function CamposEquipa({
  equipa,
  pessoas,
  membros = [],
}: {
  equipa?: Equipa | null
  pessoas: { id: string; nome: string }[]
  membros?: string[]
}) {
  return (
    <>
      <GrelhaCampos>
        <Campo etiqueta="Nome" htmlFor="nome" obrigatorio>
          <Entrada
            id="nome"
            name="nome"
            defaultValue={equipa?.nome ?? ''}
            placeholder="Horseball Sub-16"
            required
            autoFocus
            autoComplete="off"
          />
        </Campo>

        <Campo etiqueta="Escalão" htmlFor="escalao" ajuda="Ex.: Sub-16, Sénior">
          <Entrada
            id="escalao"
            name="escalao"
            defaultValue={equipa?.escalao ?? ''}
            autoComplete="off"
          />
        </Campo>

        <div className="flex items-end pb-2">
          <Caixa
            id="activa"
            name="activa"
            etiqueta="Equipa activa"
            defaultChecked={equipa?.activa ?? true}
          />
        </div>
      </GrelhaCampos>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Jogadores</legend>
        <p className="text-xs text-muted-foreground">
          Marcar a equipa num treino novo convoca estas pessoas de uma vez.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {pessoas.map((pessoa) => (
            <Caixa
              key={pessoa.id}
              id={`membro-${pessoa.id}`}
              name="membros"
              value={pessoa.id}
              etiqueta={pessoa.nome}
              defaultChecked={membros.includes(pessoa.id)}
            />
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Etiqueta htmlFor="notas">Notas</Etiqueta>
        <AreaTexto id="notas" name="notas" defaultValue={equipa?.notas ?? ''} />
      </div>
    </>
  )
}
