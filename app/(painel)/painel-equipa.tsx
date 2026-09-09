import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { Indicador } from '@/components/indicador'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  SemRegistos,
  TituloCartao,
} from '@/components/ui/superficie'
import { Cabecalho, Corpo, Linha, Tabela, Td, Th } from '@/components/ui/tabela'
import { ROTULOS_REGIME } from '@/lib/rotulos'

/** Painel de instrutores e tratadores: cadastro, sem qualquer financeiro. */
export async function PainelEquipa({ nome }: { nome: string }) {
  const supabase = await criarClienteServidor()

  const [cavalos, boxes, pessoas] = await Promise.all([
    supabase
      .from('cavalos')
      .select('id, nome, regime, raca', { count: 'exact' })
      .eq('activo', true)
      .order('nome')
      .limit(12),
    supabase
      .from('boxes')
      .select('id, identificacao, zona, cavalo_id', { count: 'exact' })
      .eq('activa', true),
    supabase
      .from('pessoas')
      .select('id', { count: 'exact', head: true })
      .eq('activo', true),
  ])

  const ocupadas = (boxes.data ?? []).filter((box) => box.cavalo_id).length

  return (
    <>
      <CabecalhoPagina
        titulo={`Olá, ${nome.split(' ')[0]}`}
        descricao="Cadastro do centro"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Indicador
          rotulo="Cavalos activos"
          valor={String(cavalos.count ?? 0)}
        />
        <Indicador
          rotulo="Boxes ocupadas"
          valor={`${ocupadas} / ${boxes.count ?? 0}`}
        />
        <Indicador rotulo="Pessoas activas" valor={String(pessoas.count ?? 0)} />
      </div>

      <Cartao className="mt-4">
        <CabecalhoCartao>
          <TituloCartao>Cavalos</TituloCartao>
        </CabecalhoCartao>
        <ConteudoCartao className="px-0 sm:px-0">
          {cavalos.data && cavalos.data.length > 0 ? (
            <Tabela>
              <Cabecalho>
                <Linha>
                  <Th>Nome</Th>
                  <Th>Raça</Th>
                  <Th>Regime</Th>
                </Linha>
              </Cabecalho>
              <Corpo>
                {cavalos.data.map((cavalo) => (
                  <Linha key={cavalo.id}>
                    <Td>
                      <Link
                        href={`/cavalos/${cavalo.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {cavalo.nome}
                      </Link>
                    </Td>
                    <Td className="text-muted-foreground">{cavalo.raca ?? '—'}</Td>
                    <Td>{ROTULOS_REGIME[cavalo.regime]}</Td>
                  </Linha>
                ))}
              </Corpo>
            </Tabela>
          ) : (
            <SemRegistos titulo="Ainda não há cavalos registados" />
          )}
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
