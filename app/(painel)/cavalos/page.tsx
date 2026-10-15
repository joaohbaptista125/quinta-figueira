import type { Metadata } from 'next'
import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirPessoa } from '@/lib/sessao'
import { eEquipa, eGestao } from '@/lib/permissoes'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { Pesquisa } from '@/components/pesquisa'
import { classesBotao } from '@/components/ui/botao'
import { Cartao, Distintivo, SemRegistos } from '@/components/ui/superficie'
import {
  Cabecalho,
  Corpo,
  LigacaoFicha,
  LigacaoInterna,
  Linha,
  Tabela,
  Td,
  Th,
} from '@/components/ui/tabela'
import { ROTULOS_REGIME, ROTULOS_SEXO } from '@/lib/rotulos'
import type {
  EstadoFerracao as EstadoFerracaoBd,
  RegimeCavalo,
} from '@/lib/tipos-bd'
import { formatarData, idadeEmAnos } from '@/lib/formatos'

export const metadata: Metadata = { title: 'Cavalos' }

export default async function PaginaCavalos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; regime?: string; inactivos?: string }>
}) {
  const sessao = await exigirPessoa()
  const { q, regime, inactivos } = await searchParams
  const supabase = await criarClienteServidor()

  let consulta = supabase
    .from('cavalos')
    .select(
      'id, nome, data_nascimento, sexo, raca, pelagem, regime, activo, pessoas(id, nome), boxes(identificacao)',
    )
    .order('nome')

  if (inactivos !== '1') consulta = consulta.eq('activo', true)
  // O parâmetro vem do URL: só é aceite se for mesmo um dos regimes válidos.
  if (regime && regime in ROTULOS_REGIME) {
    consulta = consulta.eq('regime', regime as RegimeCavalo)
  }
  if (q) {
    const termo = `%${q}%`
    consulta = consulta.or(
      `nome.ilike.${termo},raca.ilike.${termo},num_passaporte.ilike.${termo},microchip.ilike.${termo}`,
    )
  }

  // O cliente só recebe os cavalos dele, por isso a coluna do proprietário
  // era o nome dele repetido em todas as linhas, e os filtros por regime
  // («Escola», «Centro») nunca lhe devolviam nada.
  const daCavalarica = eEquipa(sessao.perfil)

  const [{ data: cavalos, error }, ferracoes] = await Promise.all([
    consulta,
    // Uma linha por cavalo, e não uma consulta por cavalo: quem prepara a
    // volta do ferrador quer ver os sessenta de uma vez.
    daCavalarica
      ? supabase
          .from('v_ferracao_cavalos')
          .select('cavalo_id, proxima_em, estado')
      : Promise.resolve({ data: null }),
  ])

  const ferracaoPorCavalo = new Map(
    (ferracoes.data ?? []).map((linha) => [linha.cavalo_id, linha]),
  )

  return (
    <>
      <CabecalhoPagina
        titulo="Cavalos"
        descricao={`${cavalos?.length ?? 0} cavalo(s)`}
        accoes={
          eGestao(sessao.perfil) ? (
            <>
              <Link
                href="/cavalos/opcoes"
                className={classesBotao('contorno')}
              >
                Raças e pelagens
              </Link>
              <Link href="/cavalos/novo" className={classesBotao()}>
                Novo cavalo
              </Link>
            </>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Pesquisa placeholder="Pesquisar por nome, raça, passaporte ou chip" />
        {daCavalarica ? (
          <div className="flex gap-1.5 text-sm">
            <FiltroRegime activo={regime} valor={undefined} rotulo="Todos" />
            <FiltroRegime activo={regime} valor="penso" rotulo="A penso" />
            <FiltroRegime activo={regime} valor="escola" rotulo="Escola" />
            <FiltroRegime activo={regime} valor="centro" rotulo="Centro" />
          </div>
        ) : null}
        <Link
          href={inactivos === '1' ? '/cavalos' : '/cavalos?inactivos=1'}
          className="text-sm text-muted-foreground underline"
        >
          {inactivos === '1' ? 'Mostrar só activos' : 'Incluir inactivos'}
        </Link>
      </div>

      <Cartao>
        {error ? (
          <SemRegistos titulo="Não foi possível carregar" descricao={error.message} />
        ) : cavalos && cavalos.length > 0 ? (
          <Tabela>
            <Cabecalho>
              <Linha>
                <Th>Nome</Th>
                <Th>Regime</Th>
                {daCavalarica ? <Th>Proprietário</Th> : null}
                <Th>Raça / pelagem</Th>
                <Th>Idade</Th>
                <Th>Box</Th>
                {daCavalarica ? <Th>Ferração</Th> : null}
              </Linha>
            </Cabecalho>
            <Corpo>
              {cavalos.map((cavalo) => {
                const idade = idadeEmAnos(cavalo.data_nascimento)
                return (
                  <Linha key={cavalo.id}>
                    <Td>
                      <LigacaoFicha href={`/cavalos/${cavalo.id}`}>{cavalo.nome}</LigacaoFicha>
                      {!cavalo.activo ? (
                        <Distintivo className="ml-2">Inactivo</Distintivo>
                      ) : null}
                      {cavalo.sexo ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {ROTULOS_SEXO[cavalo.sexo]}
                        </span>
                      ) : null}
                    </Td>
                    <Td rotulo="Regime">
                      <Distintivo
                        cor={cavalo.regime === 'penso' ? 'primario' : 'neutro'}
                      >
                        {ROTULOS_REGIME[cavalo.regime]}
                      </Distintivo>
                    </Td>
                    {daCavalarica ? (
                      <Td rotulo="Proprietário" className="text-muted-foreground">
                        {cavalo.pessoas ? (
                          <LigacaoInterna href={`/pessoas/${cavalo.pessoas.id}`}>{cavalo.pessoas.nome}</LigacaoInterna>
                        ) : (
                          '—'
                        )}
                      </Td>
                    ) : null}
                    <Td rotulo="Raça / pelagem" className="text-muted-foreground">
                      {[cavalo.raca, cavalo.pelagem].filter(Boolean).join(' · ') ||
                        '—'}
                    </Td>
                    <Td rotulo="Idade" className="text-muted-foreground">
                      {idade != null ? `${idade} anos` : '—'}
                    </Td>
                    <Td rotulo="Box" className="text-muted-foreground">
                      {cavalo.boxes?.identificacao ?? '—'}
                    </Td>
                    {daCavalarica ? (
                      <Td rotulo="Ferração">
                        <EstadoFerracao linha={ferracaoPorCavalo.get(cavalo.id)} />
                      </Td>
                    ) : null}
                  </Linha>
                )
              })}
            </Corpo>
          </Tabela>
        ) : (
          <SemRegistos
            titulo={q ? 'Nada encontrado' : 'Ainda não há cavalos'}
            accao={
              eGestao(sessao.perfil) && !q ? (
                <Link href="/cavalos/novo" className={classesBotao()}>
                  Novo cavalo
                </Link>
              ) : null
            }
          />
        )}
      </Cartao>
    </>
  )
}

function FiltroRegime({
  activo,
  valor,
  rotulo,
}: {
  activo?: string
  valor?: string
  rotulo: string
}) {
  const seleccionado = activo === valor || (!activo && !valor)
  return (
    <Link
      href={valor ? `/cavalos?regime=${valor}` : '/cavalos'}
      className={
        seleccionado
          ? 'rounded-full bg-primary px-3.5 py-1.5 text-primary-foreground'
          : 'rounded-full bg-muted px-3.5 py-1.5 text-muted-foreground hover:bg-accent'
      }
    >
      {rotulo}
    </Link>
  )
}

/**
 * O estado da ferração de um cavalo, numa pastilha.
 *
 * O que interessa a quem prepara a volta do ferrador é o que está vermelho e
 * o que está amarelo; o resto é fundo. Por isso o «em dia» mostra a data e
 * não a palavra — quem está em dia não precisa de ser lido, precisa de poder
 * ser saltado.
 */
function EstadoFerracao({
  linha,
}: {
  linha?: { estado: EstadoFerracaoBd; proxima_em: string | null }
}) {
  if (!linha || linha.estado === 'sem_registo') {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  if (linha.estado === 'atrasada') {
    return (
      <Distintivo cor="perigo">
        Atrasada desde {formatarData(linha.proxima_em)}
      </Distintivo>
    )
  }

  if (linha.estado === 'esta_semana') {
    return <Distintivo cor="aviso">{formatarData(linha.proxima_em)}</Distintivo>
  }

  if (linha.estado === 'sem_data') {
    return <Distintivo cor="aviso">Sem data</Distintivo>
  }

  return (
    <span className="tabular text-sm text-muted-foreground">
      {formatarData(linha.proxima_em)}
    </span>
  )
}
