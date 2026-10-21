import { AreaTexto, Campo, Entrada, Etiqueta, Selector } from '@/components/ui/campos'
import { GrelhaCampos } from '@/components/formulario-entidade'
import { ROTULOS_TIPO_EVENTO, paraOpcoes } from '@/lib/rotulos'
import { hoje } from '@/lib/formatos'
import type { Evento } from '@/lib/tipos-bd'

/**
 * Até quantas semanas se repete a marcação.
 *
 * Numa escola quase tudo é semanal — a aula de terça às 18:30 é a mesma até ao
 * fim do período. A lista pára nas 16 semanas de propósito: um trimestre é o
 * horizonte em que ainda se sabe quem vai estar cá.
 */
const REPETICOES = [
  { valor: 1, rotulo: 'Não repetir' },
  { valor: 2, rotulo: 'Durante 2 semanas' },
  { valor: 4, rotulo: 'Durante 4 semanas' },
  { valor: 8, rotulo: 'Durante 8 semanas' },
  { valor: 12, rotulo: 'Durante 12 semanas' },
  { valor: 16, rotulo: 'Durante 16 semanas' },
]

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

        {evento ? null : (
          <Campo
            etiqueta="Repetir"
            htmlFor="semanas"
            ajuda="Marca o mesmo à mesma hora, de semana a semana. Cada marcação fica independente: cancelar uma não mexe nas outras."
          >
            <Selector id="semanas" name="semanas" defaultValue="1">
              {REPETICOES.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </option>
              ))}
            </Selector>
          </Campo>
        )}

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
