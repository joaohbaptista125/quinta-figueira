import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { Indicador } from '@/components/indicador'
import { ProximasMarcacoes } from '@/components/resumo-do-dia'
import { classesBotao } from '@/components/ui/botao'
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
import { ROTULOS_REGIME } from '@/lib/rotulos'
import { formatarEuros } from '@/lib/formatos'

/**
 * Painel do cliente. Tudo o que aparece aqui é filtrado pela RLS: as consultas
 * não levam filtro por pessoa, é a base de dados que só devolve o que é dele.
 *
 * O detalhe do dinheiro vive em `/pagamentos` e não se repete aqui: fica só a
 * pergunta — quanto falta — e o caminho para a resposta. Dizer «contacte a
 * gestão» e mais nada era um beco, e a lista dos meses em falta repetia em
 * miniatura uma página inteira.
 */
export async function PainelCliente({ nome }: { nome: string }) {
  const supabase = await criarClienteServidor()

  const [cavalos, pensos] = await Promise.all([
    supabase
      .from('cavalos')
      .select('id, nome, regime, raca, aprovado_em')
      .eq('activo', true)
      .order('nome'),
    supabase
      .from('v_pensos_por_receber')
      .select('valor_em_falta')
      .neq('estado', 'paga'),
  ])

  const emFalta = (pensos.data ?? []).reduce(
    (soma, linha) => soma + Number(linha.valor_em_falta),
    0,
  )

  const meus = cavalos.data ?? []

  return (
    <>
      <CabecalhoPagina
        titulo={`Olá, ${nome.split(' ')[0]}`}
        descricao="Os seus cavalos e pagamentos na Quinta da Figueira"
        accoes={
          <Link href="/cavalos/novo" className={classesBotao('contorno')}>
            Inscrever cavalo
          </Link>
        }
      />

      <ProximasMarcacoes />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Indicador rotulo="Os seus cavalos" valor={String(meus.length)} />
        <Indicador
          rotulo="Por pagar"
          valor={formatarEuros(emFalta)}
          tom={emFalta > 0 ? 'negativo' : 'positivo'}
          detalhe={emFalta > 0 ? 'Ver em Pagamentos' : 'Tudo em dia'}
        />
      </div>

      <Cartao className="mt-4">
        <CabecalhoCartao className="flex flex-row items-start justify-between gap-2">
          <div>
            <TituloCartao>Os seus cavalos</TituloCartao>
            <DescricaoCartao>
              Um cavalo que inscreva fica à espera de confirmação da gestão
            </DescricaoCartao>
          </div>
          <Link
            href="/pagamentos"
            className={classesBotao('contorno', 'pequeno')}
          >
            Ver pagamentos
          </Link>
        </CabecalhoCartao>
        <ConteudoCartao className="px-0 sm:px-0">
          {meus.length > 0 ? (
            <Tabela>
              <Cabecalho>
                <Linha>
                  <Th>Nome</Th>
                  <Th>Raça</Th>
                  <Th>Regime</Th>
                </Linha>
              </Cabecalho>
              <Corpo>
                {meus.map((cavalo) => (
                  <Linha key={cavalo.id}>
                    <Td>
                      <Link
                        href={`/cavalos/${cavalo.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {cavalo.nome}
                      </Link>
                      {!cavalo.aprovado_em ? (
                        <Distintivo cor="aviso" className="ml-2">
                          A aguardar confirmação
                        </Distintivo>
                      ) : null}
                    </Td>
                    <Td rotulo="Raça" className="text-muted-foreground">
                      {cavalo.raca ?? '—'}
                    </Td>
                    <Td rotulo="Regime">
                      <Distintivo>{ROTULOS_REGIME[cavalo.regime]}</Distintivo>
                    </Td>
                  </Linha>
                ))}
              </Corpo>
            </Tabela>
          ) : (
            <SemRegistos
              titulo="Ainda não tem cavalos associados"
              descricao="Inscreva o seu cavalo — a ficha fica à espera de confirmação da gestão."
              accao={
                <Link href="/cavalos/novo" className={classesBotao()}>
                  Inscrever cavalo
                </Link>
              }
            />
          )}
        </ConteudoCartao>
      </Cartao>
    </>
  )
}
