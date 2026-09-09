import type { Metadata } from 'next'
import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirGestao } from '@/lib/sessao'
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

export const metadata: Metadata = { title: 'Fornecedores' }

export default async function PaginaFornecedores({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await exigirGestao()
  const { q } = await searchParams
  const supabase = await criarClienteServidor()

  let consulta = supabase
    .from('fornecedores')
    .select('id, nome, nif, telefone, email, activo')
    .order('nome')

  if (q) {
    const termo = `%${q}%`
    consulta = consulta.or(`nome.ilike.${termo},nif.ilike.${termo}`)
  }

  const { data: fornecedores, error } = await consulta

  return (
    <>
      <CabecalhoPagina
        titulo="Fornecedores"
        accoes={
          <Link href="/financeiro/fornecedores/novo" className={classesBotao()}>
            Novo fornecedor
          </Link>
        }
      />

      <div className="mb-4">
        <Pesquisa placeholder="Pesquisar por nome ou NIF" />
      </div>

      <Cartao>
        {error ? (
          <SemRegistos titulo="Não foi possível carregar" descricao={error.message} />
        ) : fornecedores && fornecedores.length > 0 ? (
          <Tabela>
            <Cabecalho>
              <Linha>
                <Th>Nome</Th>
                <Th>NIF</Th>
                <Th>Contactos</Th>
              </Linha>
            </Cabecalho>
            <Corpo>
              {fornecedores.map((fornecedor) => (
                <Linha key={fornecedor.id}>
                  <Td>
                    <LigacaoFicha href={`/financeiro/fornecedores/${fornecedor.id}`}>{fornecedor.nome}</LigacaoFicha>
                    {!fornecedor.activo ? (
                      <Distintivo className="ml-2">Inactivo</Distintivo>
                    ) : null}
                  </Td>
                  <Td className="text-muted-foreground">{fornecedor.nif ?? '—'}</Td>
                  <Td className="text-muted-foreground">
                    <div className="text-xs">
                      {fornecedor.telefone ?? ''}
                      {fornecedor.telefone && fornecedor.email ? <br /> : null}
                      {fornecedor.email ?? ''}
                      {!fornecedor.telefone && !fornecedor.email ? '—' : null}
                    </div>
                  </Td>
                </Linha>
              ))}
            </Corpo>
          </Tabela>
        ) : (
          <SemRegistos
            titulo={q ? 'Nada encontrado' : 'Ainda não há fornecedores'}
            accao={
              !q ? (
                <Link
                  href="/financeiro/fornecedores/novo"
                  className={classesBotao()}
                >
                  Novo fornecedor
                </Link>
              ) : null
            }
          />
        )}
      </Cartao>
    </>
  )
}
