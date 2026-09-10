import { Campo, Caixa, Entrada, AreaTexto, Selector, Etiqueta } from '@/components/ui/campos'
import { GrelhaCampos, SeccaoCampos } from '@/components/formulario-entidade'
import { ROTULOS_PAPEL, ROTULOS_PERFIL, paraOpcoes } from '@/lib/rotulos'
import type { PapelPessoa, Pessoa } from '@/lib/tipos-bd'

export function CamposPessoa({
  pessoa,
  papeis = [],
  temLogin = false,
}: {
  pessoa?: Pessoa | null
  papeis?: PapelPessoa[]
  temLogin?: boolean
}) {
  return (
    <div className="space-y-6">
      <SeccaoCampos
        titulo="Contactos"
        descricao="Só o nome é obrigatório. O resto pode ser preenchido mais tarde."
      >
        <GrelhaCampos>
          <Campo
            etiqueta="Nome"
            htmlFor="nome"
            obrigatorio
            className="sm:col-span-2"
          >
            <Entrada
              id="nome"
              name="nome"
              defaultValue={pessoa?.nome ?? ''}
              required
              autoFocus
              autoComplete="off"
            />
          </Campo>

          <Campo
            etiqueta="Email"
            htmlFor="email"
            ajuda="Serve para dar acesso à aplicação: ao ser convidada, a conta liga-se sozinha a esta ficha."
          >
            <Entrada
              id="email"
              name="email"
              type="email"
              inputMode="email"
              defaultValue={pessoa?.email ?? ''}
              autoComplete="off"
            />
          </Campo>

          <Campo etiqueta="Telefone" htmlFor="telefone">
            <Entrada
              id="telefone"
              name="telefone"
              type="tel"
              inputMode="tel"
              defaultValue={pessoa?.telefone ?? ''}
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
              defaultValue={pessoa?.nif ?? ''}
              autoComplete="off"
            />
          </Campo>

          <Campo etiqueta="Morada" htmlFor="morada">
            <Entrada
              id="morada"
              name="morada"
              defaultValue={pessoa?.morada ?? ''}
              autoComplete="off"
            />
          </Campo>
        </GrelhaCampos>
      </SeccaoCampos>

      <SeccaoCampos
        titulo="Papéis no centro"
        descricao="Pode escolher vários. Descrevem o que a pessoa faz — são independentes do perfil de acesso."
      >
        <fieldset>
          <legend className="sr-only">Papéis no centro</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {paraOpcoes(ROTULOS_PAPEL).map((opcao) => (
              <Caixa
                key={opcao.valor}
                id={`papel-${opcao.valor}`}
                name="papeis"
                value={opcao.valor}
                etiqueta={opcao.rotulo}
                defaultChecked={papeis.includes(opcao.valor)}
              />
            ))}
          </div>
        </fieldset>
      </SeccaoCampos>

      <SeccaoCampos
        titulo="Acesso e estado"
        descricao="Uma pessoa pode existir sem nunca entrar na aplicação."
      >
        <GrelhaCampos>
          <Campo
            etiqueta="Perfil de acesso"
            htmlFor="perfil"
            ajuda={
              temLogin
                ? 'Esta pessoa já tem conta. O perfil decide o que consegue ver.'
                : 'Só é preciso se lhe for dado acesso à aplicação.'
            }
          >
            <Selector id="perfil" name="perfil" defaultValue={pessoa?.perfil ?? ''}>
              <option value="">Sem acesso à aplicação</option>
              {paraOpcoes(ROTULOS_PERFIL).map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </option>
              ))}
            </Selector>
          </Campo>

          <div className="flex items-end pb-2">
            <Caixa
              id="activo"
              name="activo"
              etiqueta="Pessoa activa"
              defaultChecked={pessoa?.activo ?? true}
            />
          </div>
        </GrelhaCampos>

        <div className="space-y-1.5">
          <Etiqueta htmlFor="notas">Notas</Etiqueta>
          <AreaTexto id="notas" name="notas" defaultValue={pessoa?.notas ?? ''} />
        </div>
      </SeccaoCampos>
    </div>
  )
}
