import {
  AreaTexto,
  Caixa,
  Campo,
  Entrada,
  Etiqueta,
  Selector,
} from '@/components/ui/campos'
import { GrelhaCampos, SeccaoCampos } from '@/components/formulario-entidade'
import { CampoFicheiro } from '@/components/campo-ficheiro'
import { SelectorComOutro } from '@/components/formularios/selector-com-outro'
import { ROTULOS_REGIME, ROTULOS_SEXO, paraOpcoes } from '@/lib/rotulos'
import type { Cavalo } from '@/lib/tipos-bd'

export type OpcaoPessoa = { id: string; nome: string }

export function CamposCavalo({
  cavalo,
  proprietarios,
  racas,
  pelagens,
}: {
  cavalo?: Cavalo | null
  proprietarios: OpcaoPessoa[]
  /** Lista de raças activas, de `opcoes_cavalo`. */
  racas: string[]
  /** Lista de pelagens activas, de `opcoes_cavalo`. */
  pelagens: string[]
}) {
  return (
    <div className="space-y-6">
      <SeccaoCampos
        titulo="Identificação"
        descricao="O mínimo para o cavalo poder ser usado no resto da aplicação."
      >
        <GrelhaCampos>
          <Campo etiqueta="Nome" htmlFor="nome" obrigatorio>
            <Entrada
              id="nome"
              name="nome"
              defaultValue={cavalo?.nome ?? ''}
              required
              autoFocus
              autoComplete="off"
            />
          </Campo>

          <Campo etiqueta="Regime" htmlFor="regime" obrigatorio>
            <Selector
              id="regime"
              name="regime"
              defaultValue={cavalo?.regime ?? 'penso'}
              required
            >
              {paraOpcoes(ROTULOS_REGIME).map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </option>
              ))}
            </Selector>
          </Campo>

          <Campo
            etiqueta="Proprietário"
            htmlFor="proprietario_id"
            ajuda="Obrigatório para cavalos a penso. Ignorado nos outros regimes."
            className="sm:col-span-2"
          >
            <Selector
              id="proprietario_id"
              name="proprietario_id"
              defaultValue={cavalo?.proprietario_id ?? ''}
            >
              <option value="">— Sem proprietário —</option>
              {proprietarios.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome}
                </option>
              ))}
            </Selector>
          </Campo>
        </GrelhaCampos>
      </SeccaoCampos>

      <SeccaoCampos titulo="Características">
        <GrelhaCampos>
          <Campo etiqueta="Data de nascimento" htmlFor="data_nascimento">
            <Entrada
              id="data_nascimento"
              name="data_nascimento"
              type="date"
              defaultValue={cavalo?.data_nascimento ?? ''}
            />
          </Campo>

          <Campo etiqueta="Sexo" htmlFor="sexo">
            <Selector id="sexo" name="sexo" defaultValue={cavalo?.sexo ?? ''}>
              <option value="">—</option>
              {paraOpcoes(ROTULOS_SEXO).map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </option>
              ))}
            </Selector>
          </Campo>

          <Campo
            etiqueta="Raça"
            htmlFor="raca"
            ajuda="Falta alguma? Escolha «Outra raça» e escreva-a — fica na lista."
          >
            <SelectorComOutro
              id="raca"
              name="raca"
              opcoes={racas}
              valorInicial={cavalo?.raca}
              rotuloNova="Outra raça — escrever…"
              exemplo="Ex.: Hanoveriano"
            />
          </Campo>

          <Campo
            etiqueta="Pelagem"
            htmlFor="pelagem"
            ajuda="Falta alguma? Escolha «Outra pelagem» e escreva-a — fica na lista."
          >
            <SelectorComOutro
              id="pelagem"
              name="pelagem"
              opcoes={pelagens}
              valorInicial={cavalo?.pelagem}
              rotuloNova="Outra pelagem — escrever…"
              exemplo="Ex.: Preto"
            />
          </Campo>
        </GrelhaCampos>
      </SeccaoCampos>

      <SeccaoCampos
        titulo="Documentos e fotografia"
        descricao="Pode ficar para depois — nada nesta secção é obrigatório."
      >
        <GrelhaCampos>
          <Campo etiqueta="Nº de passaporte / registo" htmlFor="num_passaporte">
            <Entrada
              id="num_passaporte"
              name="num_passaporte"
              defaultValue={cavalo?.num_passaporte ?? ''}
              autoComplete="off"
            />
          </Campo>

          <Campo etiqueta="Microchip" htmlFor="microchip">
            <Entrada
              id="microchip"
              name="microchip"
              defaultValue={cavalo?.microchip ?? ''}
              autoComplete="off"
            />
          </Campo>

          <Campo
            etiqueta="Foto"
            htmlFor="foto"
            ajuda="JPEG, PNG ou WebP, até 10 MB. Vai directa para o Storage assim que a escolher."
            className="sm:col-span-2"
          >
            <CampoFicheiro
              name="foto_path"
              bucket="cavalos"
              accept="image/jpeg,image/png,image/webp,image/heic"
              valorInicial={cavalo?.foto_path}
              tamanhoMaximoMB={10}
            />
          </Campo>
        </GrelhaCampos>
      </SeccaoCampos>

      <SeccaoCampos titulo="Estado e notas">
        <Caixa
          id="activo"
          name="activo"
          etiqueta="Cavalo activo"
          defaultChecked={cavalo?.activo ?? true}
        />

        <div className="space-y-1.5">
          <Etiqueta htmlFor="notas">Notas</Etiqueta>
          <AreaTexto
            id="notas"
            name="notas"
            defaultValue={cavalo?.notas ?? ''}
          />
        </div>
      </SeccaoCampos>
    </div>
  )
}
