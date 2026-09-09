import type { Metadata } from 'next'
import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirGestao } from '@/lib/sessao'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { classesBotao } from '@/components/ui/botao'
import { Cartao, Distintivo, SemRegistos } from '@/components/ui/superficie'
import { Cabecalho, Corpo, Linha, Tabela, Td, Th } from '@/components/ui/tabela'

export const metadata: Metadata = { title: 'Categorias de despesa' }

export default async function PaginaCategorias() {
  await exigirGestao()
  const supabase = await criarClienteServidor()

  const { data: categorias, error } = await supabase
    .from('categorias_despesa')
    .select('id, nome, slug, ordem, activa')
    .order('ordem')
    .order('nome')

  return (
    <>
      <CabecalhoPagina
        titulo="Categorias de despesa"
        descricao="Vêm preenchidas de origem; ajuste-as ao vocabulário do centro."
        accoes={
          <Link href="/financeiro/categorias/nova" className={classesBotao()}>
            Nova categoria
          </Link>
        }
      />

      <Cartao>
        {error ? (
          <SemRegistos titulo="Não foi possível carregar" descricao={error.message} />
        ) : categorias && categorias.length > 0 ? (
          <Tabela>
            <Cabecalho>
              <Linha>
                <Th>Nome</Th>
                <Th>Ordem</Th>
                <Th>Estado</Th>
              </Linha>
            </Cabecalho>
            <Corpo>
              {categorias.map((categoria) => (
                <Linha key={categoria.id}>
                  <Td>
                    <Link
                      href={`/financeiro/categorias/${categoria.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {categoria.nome}
                    </Link>
                  </Td>
                  <Td className="text-muted-foreground">{categoria.ordem}</Td>
                  <Td>
                    {categoria.activa ? (
                      <Distintivo cor="sucesso">Activa</Distintivo>
                    ) : (
                      <Distintivo>Inactiva</Distintivo>
                    )}
                  </Td>
                </Linha>
              ))}
            </Corpo>
          </Tabela>
        ) : (
          <SemRegistos titulo="Sem categorias" />
        )}
      </Cartao>
    </>
  )
}
