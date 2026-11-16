import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirPessoa } from '@/lib/sessao'
import { eEquipa, eGestao } from '@/lib/permissoes'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { ErroConsulta } from '@/components/erro-consulta'
import { FormularioEntidade } from '@/components/formulario-entidade'
import { CamposCavalo } from '@/components/formularios/campos-cavalo'
import { FotoCavalo } from '@/components/foto-cavalo'
import { FerracaoCavalo } from '@/components/ferracao-cavalo'
import { NotasCavalo } from '@/components/notas-cavalo'
import { DecidirCavalo } from '@/components/decidir-cavalo'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  Distintivo,
  SemRegistos,
  TituloCartao,
} from '@/components/ui/superficie'
import { Cabecalho, Corpo, Linha, Tabela, Td, Th } from '@/components/ui/tabela'
import {
  alternarActivoCavalo,
  apagarCavalo,
  guardarCavalo,
} from '@/lib/accoes/cavalos'
import { AccoesFicha } from '@/components/accoes-ficha'
import { ROTULOS_REGIME, ROTULOS_SEXO } from '@/lib/rotulos'
import { formatarData, formatarEuros, hoje, idadeEmAnos } from '@/lib/formatos'
import { opcoesDeCavalo } from '@/lib/consultas'

export const metadata: Metadata = { title: 'Ficha de cavalo' }

export default async function PaginaCavalo({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sessao = await exigirPessoa()
  const { id } = await params
  const supabase = await criarClienteServidor()

  const { data: cavalo, error } = await supabase
    .from('cavalos')
    .select('*, pessoas(id, nome)')
    .eq('id', id)
    .maybeSingle()

  if (error) return <ErroConsulta erro={error} contexto="a ficha do cavalo" />
  if (!cavalo) notFound()

  const podeEditar = eGestao(sessao.perfil)
  const idade = idadeEmAnos(cavalo.data_nascimento)

  // Uma proposta ainda por decidir é a única altura em que o dono escreve na
  // ficha: enquanto ninguém decidiu, corrigir o que escreveu há dois minutos
  // não devia obrigar a pedir a alguém. Depois de aprovada, a correcção é uma
  // nota — que deixa rasto e é o caminho que já existia. A RLS diz o mesmo.
  const porAprovar = cavalo.aprovado_em === null
  const souODono = cavalo.proprietario_id === sessao.id
  const podeCorrigirProposta = porAprovar && souODono

  const [
    proprietarios,
    opcoes,
    noPaddock,
    contratos,
    despesas,
    ferracoes,
    notas,
  ] = await Promise.all([
      podeEditar
        ? supabase.from('pessoas').select('id, nome').eq('activo', true).order('nome')
        : Promise.resolve({ data: null }),
      opcoesDeCavalo(supabase),
      // O quadro dos paddocks é em `/paddocks`; aqui basta dizer se o cavalo
      // saiu hoje, que é o que o dono vem ver.
      supabase
        .from('paddock_ocupacao')
        .select('paddocks(numero, nome)')
        .eq('cavalo_id', id)
        .eq('data', hoje())
        .maybeSingle(),
      podeEditar
        ? supabase
            .from('contratos_penso')
            .select('id, valor_mensal, data_inicio, data_fim, pessoas(id, nome)')
            .eq('cavalo_id', id)
            .order('data_inicio', { ascending: false })
        : Promise.resolve({ data: null }),
      podeEditar
        ? supabase
            .from('despesas')
            .select('id, data, descricao, valor_total, categorias_despesa(nome)')
            .eq('cavalo_id', id)
            .order('data', { ascending: false })
            .limit(10)
        : Promise.resolve({ data: null }),
      // A ferração vê-se de dentro da cavalariça e também do lado do dono:
      // a RLS devolve as dos cavalos dele, e a pergunta «quando foi ferrado»
      // é a mesma dos dois lados.
      supabase
        .from('ferracoes')
        .select('id, data, tipo, proxima_em, ferrador, custo, notas, pago_em')
        .eq('cavalo_id', id)
        .order('data', { ascending: false })
        .limit(12),
      // A conversa do cavalo: o dono pergunta, a cavalariça responde.
      supabase
        .from('notas_cavalo')
        .select('id, texto, criado_em, de_equipa, pessoas(nome)')
        .eq('cavalo_id', id)
        .order('criado_em'),
    ])

  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/cavalos', rotulo: 'Cavalos' }}
        titulo={cavalo.nome}
        descricao={
          <span className="flex flex-wrap items-center gap-1.5">
            <Distintivo cor={cavalo.regime === 'penso' ? 'primario' : 'neutro'}>
              {ROTULOS_REGIME[cavalo.regime]}
            </Distintivo>
            {cavalo.sexo ? <Distintivo>{ROTULOS_SEXO[cavalo.sexo]}</Distintivo> : null}
            {idade != null ? <Distintivo>{idade} anos</Distintivo> : null}
            {noPaddock.data?.paddocks ? (
              <Distintivo cor="informacao">
                Hoje no paddock {noPaddock.data.paddocks.numero}
              </Distintivo>
            ) : null}
            {porAprovar ? (
              <Distintivo cor="aviso">Por aprovar</Distintivo>
            ) : null}
            {!cavalo.activo ? <Distintivo cor="aviso">Inactivo</Distintivo> : null}
          </span>
        }
        accoes={
          podeEditar ? (
            <AccoesFicha
              id={cavalo.id}
              alternar={{
                accao: alternarActivoCavalo,
                rotulo: cavalo.activo ? 'Desactivar' : 'Reactivar',
                titulo: cavalo.activo
                  ? `${cavalo.nome} sai das listas e das convocatórias, e tudo o que já lá está fica`
                  : `${cavalo.nome} volta a aparecer nas listas`,
                icone: cavalo.activo ? 'esconder' : 'mostrar',
              }}
              apagar={{
                accao: apagarCavalo,
                confirmacao: `Apagar a ficha de ${cavalo.nome} para sempre?\n\nSó funciona num cavalo que nunca chegou a ter nada — sem contratos, despesas, participações em eventos nem ferrações. Com qualquer uma dessas coisas a aplicação recusa e manda desactivar.`,
              }}
            />
          ) : null
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Cartao>
          <CabecalhoCartao>
            <TituloCartao>
              {podeEditar || podeCorrigirProposta ? 'Dados' : 'Ficha'}
            </TituloCartao>
          </CabecalhoCartao>
          <ConteudoCartao>
            {podeEditar || podeCorrigirProposta ? (
              <FormularioEntidade
                accao={guardarCavalo}
                id={cavalo.id}
                hrefCancelar="/cavalos"
              >
                <CamposCavalo
                  cavalo={cavalo}
                  proprietarios={proprietarios.data ?? []}
                  racas={opcoes.racas}
                  pelagens={opcoes.pelagens}
                  modo={podeEditar ? 'completo' : 'proposta'}
                />
              </FormularioEntidade>
            ) : (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Detalhe rotulo="Raça" valor={cavalo.raca} />
                <Detalhe rotulo="Pelagem" valor={cavalo.pelagem} />
                <Detalhe
                  rotulo="Data de nascimento"
                  valor={formatarData(cavalo.data_nascimento)}
                />
                <Detalhe rotulo="Microchip" valor={cavalo.microchip} />
                <Detalhe rotulo="Passaporte" valor={cavalo.num_passaporte} />
                <Detalhe
                  rotulo="Proprietário"
                  valor={cavalo.pessoas?.nome ?? null}
                />
                {cavalo.notas ? (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Notas</dt>
                    <dd className="whitespace-pre-wrap">{cavalo.notas}</dd>
                  </div>
                ) : null}
              </dl>
            )}
          </ConteudoCartao>
        </Cartao>

        <div className="space-y-4">
          {porAprovar && podeEditar ? (
            <DecidirCavalo
              cavaloId={cavalo.id}
              nome={cavalo.nome}
              proposto={cavalo.pessoas?.nome ?? null}
            />
          ) : null}

          <FotoCavalo caminho={cavalo.foto_path} nome={cavalo.nome} />

          <FerracaoCavalo
            cavaloId={cavalo.id}
            ferracoes={ferracoes.data ?? []}
            /*
             * Nos cavalos em que é o dono que paga ao ferrador, é ele que
             * regista a visita: o centro pode nem saber que ela aconteceu.
             * A RLS diz o mesmo — isto só evita mostrar um formulário que ia
             * ser recusado.
             */
            podeRegistar={
              eEquipa(sessao.perfil) ||
              (cavalo.proprietario_id === sessao.id &&
                cavalo.ferrador_pago_por === 'proprietario')
            }
            temProprietario={Boolean(cavalo.proprietario_id)}
            pagoPor={cavalo.ferrador_pago_por}
            souOProprietario={cavalo.proprietario_id === sessao.id}
          />

          <NotasCavalo
            cavaloId={cavalo.id}
            notas={notas.data ?? []}
            podeEscrever={
              eEquipa(sessao.perfil) || cavalo.proprietario_id === sessao.id
            }
            podeApagar={podeEditar}
            souDaEquipa={eEquipa(sessao.perfil)}
          />

          {podeEditar ? (
            <>
              <Cartao>
                <CabecalhoCartao className="flex flex-row items-start justify-between gap-2">
                  <TituloCartao>Contratos de penso</TituloCartao>
                  <Link
                    href={`/contratos/novo?cavalo=${cavalo.id}`}
                    className="text-sm text-primary underline"
                  >
                    Novo
                  </Link>
                </CabecalhoCartao>
                <ConteudoCartao className="px-0 sm:px-0">
                  {contratos.data && contratos.data.length > 0 ? (
                    <Tabela>
                      <Cabecalho>
                        <Linha>
                          <Th>Cliente</Th>
                          <Th>Início</Th>
                          <Th numerico>Mensal</Th>
                        </Linha>
                      </Cabecalho>
                      <Corpo>
                        {contratos.data.map((contrato) => (
                          <Linha key={contrato.id}>
                            <Td>
                              <Link
                                href={`/contratos/${contrato.id}`}
                                className="underline-offset-2 hover:underline"
                              >
                                {contrato.pessoas?.nome ?? '—'}
                              </Link>
                              {contrato.data_fim ? (
                                <Distintivo className="ml-2">Terminado</Distintivo>
                              ) : null}
                            </Td>
                            <Td rotulo="Início" className="whitespace-nowrap text-muted-foreground">
                              {formatarData(contrato.data_inicio)}
                            </Td>
                            <Td rotulo="Mensal" numerico>{formatarEuros(contrato.valor_mensal)}</Td>
                          </Linha>
                        ))}
                      </Corpo>
                    </Tabela>
                  ) : (
                    <SemRegistos titulo="Sem contratos" />
                  )}
                </ConteudoCartao>
              </Cartao>

              <Cartao>
                <CabecalhoCartao>
                  <TituloCartao>Despesas imputadas</TituloCartao>
                  <DescricaoCartao>
                    Veterinário, ferrador e outras despesas deste cavalo
                  </DescricaoCartao>
                </CabecalhoCartao>
                <ConteudoCartao className="px-0 sm:px-0">
                  {despesas.data && despesas.data.length > 0 ? (
                    <Tabela>
                      <Corpo>
                        {despesas.data.map((despesa) => (
                          <Linha key={despesa.id}>
                            <Td className="whitespace-nowrap text-muted-foreground">
                              {formatarData(despesa.data)}
                            </Td>
                            <Td>
                              <Link
                                href={`/financeiro/despesas/${despesa.id}`}
                                className="underline-offset-2 hover:underline"
                              >
                                {despesa.descricao}
                              </Link>
                            </Td>
                            <Td numerico>{formatarEuros(despesa.valor_total)}</Td>
                          </Linha>
                        ))}
                      </Corpo>
                    </Tabela>
                  ) : (
                    <SemRegistos titulo="Sem despesas imputadas" />
                  )}
                </ConteudoCartao>
              </Cartao>
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}

function Detalhe({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd>{valor && valor !== '—' ? valor : '—'}</dd>
    </div>
  )
}
