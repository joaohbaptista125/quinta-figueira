import type { Metadata } from 'next'
import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirEquipa } from '@/lib/sessao'
import { eGestao } from '@/lib/permissoes'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { Pesquisa } from '@/components/pesquisa'
import { classesBotao } from '@/components/ui/botao'
import { Cartao, Distintivo, SemRegistos } from '@/components/ui/superficie'
import {
  Cabecalho,
  Corpo,
  LigacaoFicha,
  Linha,
  Tabela,
  Td,
  Th,
} from '@/components/ui/tabela'
import { ROTULOS_PAPEL, ROTULOS_PERFIL } from '@/lib/rotulos'
import type { PapelPessoa } from '@/lib/tipos-bd'

export const metadata: Metadata = { title: 'Pessoas' }

export default async function PaginaPessoas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; inactivos?: string }>
}) {
  const sessao = await exigirEquipa()
  const { q, inactivos } = await searchParams
  const supabase = await criarClienteServidor()

  let consulta = supabase
    .from('pessoas')
    .select('id, nome, email, telefone, nif, activo, perfil, pessoa_papeis(papel)')
    .order('nome')

  if (inactivos !== '1') consulta = consulta.eq('activo', true)
  if (q) {
    const termo = `%${q}%`
    consulta = consulta.or(
      `nome.ilike.${termo},email.ilike.${termo},telefone.ilike.${termo},nif.ilike.${termo}`,
    )
  }

  const { data: pessoas, error } = await consulta

  return (
    <>
      <CabecalhoPagina
        titulo="Pessoas"
        descricao="Alunos, proprietários, instrutores, tratadores e jogadores"
        accoes={
          eGestao(sessao.perfil) ? (
            <Link href="/pessoas/nova" className={classesBotao()}>
              Nova pessoa
            </Link>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Pesquisa placeholder="Pesquisar por nome, email, telefone ou NIF" />
        <Link
          href={inactivos === '1' ? '/pessoas' : '/pessoas?inactivos=1'}
          className="text-sm text-muted-foreground underline"
        >
          {inactivos === '1' ? 'Mostrar só activos' : 'Incluir inactivos'}
        </Link>
      </div>

      <Cartao>
        {error ? (
          <SemRegistos titulo="Não foi possível carregar" descricao={error.message} />
        ) : pessoas && pessoas.length > 0 ? (
          <Tabela>
            <Cabecalho>
              <Linha>
                <Th>Nome</Th>
                <Th>Contactos</Th>
                <Th>Papéis</Th>
                <Th>Acesso</Th>
              </Linha>
            </Cabecalho>
            <Corpo>
              {pessoas.map((pessoa) => (
                <Linha key={pessoa.id}>
                  <Td>
                    <LigacaoFicha href={`/pessoas/${pessoa.id}`}>{pessoa.nome}</LigacaoFicha>
                    {!pessoa.activo ? (
                      <Distintivo cor="neutro" className="ml-2">
                        Inactivo
                      </Distintivo>
                    ) : null}
                  </Td>
                  <Td className="text-muted-foreground">
                    <div className="flex flex-col text-xs">
                      {pessoa.email ? <span>{pessoa.email}</span> : null}
                      {pessoa.telefone ? <span>{pessoa.telefone}</span> : null}
                      {!pessoa.email && !pessoa.telefone ? <span>—</span> : null}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {(pessoa.pessoa_papeis ?? []).map(
                        (relacao: { papel: PapelPessoa }) => (
                          <Distintivo key={relacao.papel} cor="primario">
                            {ROTULOS_PAPEL[relacao.papel]}
                          </Distintivo>
                        ),
                      )}
                      {(pessoa.pessoa_papeis ?? []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : null}
                    </div>
                  </Td>
                  <Td className="text-muted-foreground">
                    {pessoa.perfil ? ROTULOS_PERFIL[pessoa.perfil] : '—'}
                  </Td>
                </Linha>
              ))}
            </Corpo>
          </Tabela>
        ) : (
          <SemRegistos
            titulo={q ? 'Nada encontrado' : 'Ainda não há pessoas'}
            descricao={
              q
                ? 'Experimente outro termo de pesquisa.'
                : 'Comece por registar os alunos e proprietários do centro.'
            }
            accao={
              eGestao(sessao.perfil) && !q ? (
                <Link href="/pessoas/nova" className={classesBotao()}>
                  Nova pessoa
                </Link>
              ) : null
            }
          />
        )}
      </Cartao>
    </>
  )
}
