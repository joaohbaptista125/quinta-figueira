import type { Metadata } from 'next'
import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirPessoa } from '@/lib/sessao'
import { eGestao } from '@/lib/permissoes'
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
import type { RegimeCavalo } from '@/lib/tipos-bd'
import { idadeEmAnos } from '@/lib/formatos'

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

  const { data: cavalos, error } = await consulta

  return (
    <>
      <CabecalhoPagina
        titulo="Cavalos"
        descricao={`${cavalos?.length ?? 0} cavalo(s)`}
        accoes={
          eGestao(sessao.perfil) ? (
            <Link href="/cavalos/novo" className={classesBotao()}>
              Novo cavalo
            </Link>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Pesquisa placeholder="Pesquisar por nome, raça, passaporte ou chip" />
        <div className="flex gap-1.5 text-sm">
          <FiltroRegime activo={regime} valor={undefined} rotulo="Todos" />
          <FiltroRegime activo={regime} valor="penso" rotulo="A penso" />
          <FiltroRegime activo={regime} valor="escola" rotulo="Escola" />
          <FiltroRegime activo={regime} valor="centro" rotulo="Centro" />
        </div>
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
                <Th>Proprietário</Th>
                <Th>Raça / pelagem</Th>
                <Th>Idade</Th>
                <Th>Box</Th>
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
                    <Td>
                      <Distintivo
                        cor={cavalo.regime === 'penso' ? 'primario' : 'neutro'}
                      >
                        {ROTULOS_REGIME[cavalo.regime]}
                      </Distintivo>
                    </Td>
                    <Td className="text-muted-foreground">
                      {cavalo.pessoas ? (
                        <LigacaoInterna href={`/pessoas/${cavalo.pessoas.id}`}>{cavalo.pessoas.nome}</LigacaoInterna>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td className="text-muted-foreground">
                      {[cavalo.raca, cavalo.pelagem].filter(Boolean).join(' · ') ||
                        '—'}
                    </Td>
                    <Td className="text-muted-foreground">
                      {idade != null ? `${idade} anos` : '—'}
                    </Td>
                    <Td className="text-muted-foreground">
                      {cavalo.boxes?.identificacao ?? '—'}
                    </Td>
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
          ? 'rounded-full bg-primary px-3 py-1 text-primary-foreground'
          : 'rounded-full bg-muted px-3 py-1 text-muted-foreground'
      }
    >
      {rotulo}
    </Link>
  )
}
