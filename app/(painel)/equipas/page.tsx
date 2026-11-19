import type { Metadata } from 'next'
import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirPessoa } from '@/lib/sessao'
import { eGestao } from '@/lib/permissoes'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
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

export const metadata: Metadata = { title: 'Equipas' }

export default async function PaginaEquipas() {
  const sessao = await exigirPessoa()
  // Criar e compor equipas é da gestão. O instrutor vê-as e usa-as —
  // convoca a equipa inteira para um treino —, mas não decide quem lá está.
  const podeEditar = eGestao(sessao.perfil)
  const supabase = await criarClienteServidor()

  const { data: equipas, error } = await supabase
    .from('equipas')
    .select('id, nome, escalao, activa, equipa_membros(pessoa_id)')
    .order('nome')

  return (
    <>
      <CabecalhoPagina
        titulo="Equipas"
        descricao="Grupos de Horseball, para convocar de uma vez"
        accoes={
          podeEditar ? (
            <Link href="/equipas/nova" className={classesBotao()}>
              Nova equipa
            </Link>
          ) : null
        }
      />

      <Cartao>
        {error ? (
          <SemRegistos titulo="Não foi possível carregar" descricao={error.message} />
        ) : equipas && equipas.length > 0 ? (
          <Tabela>
            <Cabecalho>
              <Linha>
                <Th>Equipa</Th>
                <Th>Escalão</Th>
                <Th numerico>Jogadores</Th>
              </Linha>
            </Cabecalho>
            <Corpo>
              {equipas.map((equipa) => (
                <Linha key={equipa.id}>
                  <Td>
                    <LigacaoFicha href={`/equipas/${equipa.id}`}>
                      {equipa.nome}
                    </LigacaoFicha>
                    {!equipa.activa ? (
                      <Distintivo className="ml-2">Inactiva</Distintivo>
                    ) : null}
                  </Td>
                  <Td rotulo="Escalão" className="text-muted-foreground">
                    {equipa.escalao ?? '—'}
                  </Td>
                  <Td rotulo="Jogadores" numerico>{(equipa.equipa_membros ?? []).length}</Td>
                </Linha>
              ))}
            </Corpo>
          </Tabela>
        ) : (
          <SemRegistos
            titulo="Ainda não há equipas"
            descricao="Crie uma equipa para convocar os mesmos jogadores sem os escolher um a um."
            accao={
              podeEditar ? (
                <Link href="/equipas/nova" className={classesBotao()}>
                  Nova equipa
                </Link>
              ) : null
            }
          />
        )}
      </Cartao>
    </>
  )
}
