import type { Metadata } from 'next'
import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirPessoa } from '@/lib/sessao'
import { eGestao } from '@/lib/permissoes'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { Indicador } from '@/components/indicador'
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

export const metadata: Metadata = { title: 'Boxes' }

export default async function PaginaBoxes() {
  const sessao = await exigirPessoa()
  const supabase = await criarClienteServidor()

  const { data: boxes, error } = await supabase
    .from('boxes')
    .select('id, identificacao, zona, activa, notas, cavalos(id, nome, regime)')
    .order('zona')
    .order('identificacao')

  const total = boxes?.length ?? 0
  const ocupadas = (boxes ?? []).filter((box) => box.cavalos).length
  const podeEditar = eGestao(sessao.perfil)

  return (
    <>
      <CabecalhoPagina
        titulo="Boxes"
        descricao="Atribuição de cavalos às boxes da cavalariça"
        accoes={
          podeEditar ? (
            <Link href="/boxes/nova" className={classesBotao()}>
              Nova box
            </Link>
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Indicador rotulo="Boxes" valor={String(total)} />
        <Indicador rotulo="Ocupadas" valor={String(ocupadas)} />
        <Indicador
          rotulo="Livres"
          valor={String(total - ocupadas)}
          tom={total - ocupadas > 0 ? 'positivo' : 'neutro'}
        />
      </div>

      <Cartao>
        {error ? (
          <SemRegistos titulo="Não foi possível carregar" descricao={error.message} />
        ) : boxes && boxes.length > 0 ? (
          <Tabela>
            <Cabecalho>
              <Linha>
                <Th>Box</Th>
                <Th>Zona</Th>
                <Th>Cavalo</Th>
                <Th>Estado</Th>
              </Linha>
            </Cabecalho>
            <Corpo>
              {boxes.map((box) => (
                <Linha key={box.id}>
                  <Td>
                    {podeEditar ? (
                      <LigacaoFicha href={`/boxes/${box.id}`}>{box.identificacao}</LigacaoFicha>
                    ) : (
                      <span className="font-medium">{box.identificacao}</span>
                    )}
                  </Td>
                  <Td className="text-muted-foreground">{box.zona ?? '—'}</Td>
                  <Td>
                    {box.cavalos ? (
                      <LigacaoInterna href={`/cavalos/${box.cavalos.id}`}>{box.cavalos.nome}</LigacaoInterna>
                    ) : (
                      <span className="text-muted-foreground">— vazia —</span>
                    )}
                  </Td>
                  <Td>
                    {!box.activa ? (
                      <Distintivo cor="aviso">Fora de serviço</Distintivo>
                    ) : box.cavalos ? (
                      <Distintivo cor="primario">Ocupada</Distintivo>
                    ) : (
                      <Distintivo cor="sucesso">Livre</Distintivo>
                    )}
                  </Td>
                </Linha>
              ))}
            </Corpo>
          </Tabela>
        ) : (
          <SemRegistos
            titulo="Ainda não há boxes"
            descricao="Registe as boxes da cavalariça para poder atribuir os cavalos."
            accao={
              podeEditar ? (
                <Link href="/boxes/nova" className={classesBotao()}>
                  Nova box
                </Link>
              ) : null
            }
          />
        )}
      </Cartao>
    </>
  )
}
