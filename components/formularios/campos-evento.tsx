import { AreaTexto, Campo, Entrada, Etiqueta, Selector } from '@/components/ui/campos'
import { GrelhaCampos } from '@/components/formulario-entidade'
import { ROTULOS_TIPO_EVENTO, paraOpcoes } from '@/lib/rotulos'
import { hoje } from '@/lib/formatos'
import type { Evento } from '@/lib/tipos-bd'

export function CamposEvento({
  evento,
  responsaveis,
  equipas,
  diaPorOmissao,
}: {
  evento?: Evento | null
  responsaveis: { id: string; nome: string }[]
  equipas: { id: string; nome: string }[]
  diaPorOmissao?: string
}) {
  return (
    <>
      <GrelhaCampos>
        <Campo etiqueta="Tipo" htmlFor="tipo" obrigatorio>
          <Selector
            id="tipo"
            name="tipo"
            defaultValue={evento?.tipo ?? 'aula'}
            required
            autoFocus
          >
            {paraOpcoes(ROTULOS_TIPO_EVENTO).map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Selector>
        </Campo>

        <Campo
          etiqueta="Título"
          htmlFor="titulo"
          ajuda="Opcional. Ex.: «Iniciação», «Obstáculos»."
        >
          <Entrada
            id="titulo"
            name="titulo"
            defaultValue={evento?.titulo ?? ''}
            autoComplete="off"
          />
        </Campo>

        <Campo etiqueta="Data" htmlFor="data" obrigatorio>
          <Entrada
            id="data"
            name="data"
            type="date"
            defaultValue={evento?.data ?? diaPorOmissao ?? hoje()}
            required
          />
        </Campo>

        <Campo etiqueta="Local" htmlFor="local" ajuda="Ex.: Picadeiro coberto">
          <Entrada
            id="local"
            name="local"
            defaultValue={evento?.local ?? ''}
            autoComplete="off"
          />
        </Campo>

        <Campo etiqueta="Hora de início" htmlFor="hora_inicio" obrigatorio>
          <Entrada
            id="hora_inicio"
            name="hora_inicio"
            type="time"
            defaultValue={evento?.hora_inicio?.slice(0, 5) ?? '18:00'}
            required
          />
        </Campo>

        <Campo
          etiqueta="Hora de fim"
          htmlFor="hora_fim"
          ajuda="Em branco conta como uma hora, para efeitos de ocupação dos cavalos."
        >
          <Entrada
            id="hora_fim"
            name="hora_fim"
            type="time"
            defaultValue={evento?.hora_fim?.slice(0, 5) ?? ''}
          />
        </Campo>

        <Campo etiqueta="Responsável" htmlFor="responsavel_id">
          <Selector
            id="responsavel_id"
            name="responsavel_id"
            defaultValue={evento?.responsavel_id ?? ''}
          >
            <option value="">— sem responsável —</option>
            {responsaveis.map((pessoa) => (
              <option key={pessoa.id} value={pessoa.id}>
                {pessoa.nome}
              </option>
            ))}
          </Selector>
        </Campo>

        <Campo
          etiqueta="Equipa"
          htmlFor="equipa_id"
          ajuda={
            evento
              ? 'Serve para identificar o treino.'
              : 'Num evento novo, escolher a equipa convoca já os seus membros.'
          }
        >
          <Selector
            id="equipa_id"
            name="equipa_id"
            defaultValue={evento?.equipa_id ?? ''}
          >
            <option value="">— sem equipa —</option>
            {equipas.map((equipa) => (
              <option key={equipa.id} value={equipa.id}>
                {equipa.nome}
              </option>
            ))}
          </Selector>
        </Campo>
      </GrelhaCampos>

      <div className="space-y-1.5">
        <Etiqueta htmlFor="notas">Notas</Etiqueta>
        <AreaTexto id="notas" name="notas" defaultValue={evento?.notas ?? ''} />
      </div>
    </>
  )
}
