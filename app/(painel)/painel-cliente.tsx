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
import { formatarEuros, formatarMesCapitalizado } from '@/lib/formatos'

/**
 * Painel do cliente. Tudo o que aparece aqui é filtrado pela RLS: as consultas
 * não levam filtro por pessoa, é a base de dados que só devolve o que é dele.
 *
 * O detalhe do dinheiro vive em `/pagamentos`. Aqui fica só a pergunta —
 * quanto falta — e o caminho para a resposta: dizer «contacte a gestão» e mais
 * nada era um beco, e a lista dos últimos dez pagamentos repetia em miniatura
 * uma página inteira.
 */
export async function PainelCliente({ nome }: { nome: string }) {
  const supabase = await criarClienteServidor()

  const [cavalos, pensos] = await Promise.all([
    supabase
      .from('cavalos')
      .select('id, nome, regime, raca, activo')
      .eq('activo', true)
      .order('nome'),
    supabase
      .from('v_pensos_por_receber')
      .select('*')
      .neq('estado', 'paga')
      .order('periodo', { ascending: false }),
  ])

  const emFalta = (pensos.data ?? []).reduce(
    (soma, linha) => soma + Number(linha.valor_em_falta),
    0,
  )

  return (
    <>
      <CabecalhoPagina
        titulo={`Olá, ${nome.split(' ')[0]}`}
        descricao="Os seus cavalos e pagamentos na Quinta da Figueira"
      />

      <ProximasMarcacoes />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Indicador
          rotulo="Os seus cavalos"
          valor={String(cavalos.data?.length ?? 0)}
        />
        <Indicador
          rotulo="Por pagar"
          valor={formatarEuros(emFalta)}
          tom={emFalta > 0 ? 'negativo' : 'positivo'}
          detalhe={emFalta > 0 ? 'Ver em Pagamentos' : 'Tudo em dia'}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Cartao>
          <CabecalhoCartao>
            <TituloCartao>Os seus cavalos</TituloCartao>
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
                descricao="Se isto não está certo, fale com a gestão do centro."
              />
            )}
          </ConteudoCartao>
        </Cartao>

        <Cartao>
          <CabecalhoCartao className="flex flex-row items-start justify-between gap-2">
            <div>
              <TituloCartao>Mensalidades por pagar</TituloCartao>
              <DescricaoCartao>
                Meses de penso que o centro ainda não recebeu
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
            {pensos.data && pensos.data.length > 0 ? (
              <Tabela>
                <Cabecalho>
                  <Linha>
                    <Th>Mês</Th>
                    <Th>Cavalo</Th>
                    <Th numerico>Em falta</Th>
                  </Linha>
                </Cabecalho>
                <Corpo>
                  {pensos.data.map((linha) => (
                    <Linha key={linha.mensalidade_id}>
                      <Td>{formatarMesCapitalizado(linha.periodo)}</Td>
                      <Td rotulo="Cavalo" className="text-muted-foreground">
                        {linha.cavalo_nome}
                      </Td>
                      <Td rotulo="Em falta" numerico className="font-medium">
                        {formatarEuros(linha.valor_em_falta)}
                      </Td>
                    </Linha>
                  ))}
                </Corpo>
              </Tabela>
            ) : (
              <SemRegistos titulo="Não tem nada por pagar" />
            )}
          </ConteudoCartao>
        </Cartao>
      </div>
    </>
  )
}
