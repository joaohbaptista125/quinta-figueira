import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { Indicador } from '@/components/indicador'
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
import { ROTULOS_METODO, ROTULOS_REGIME } from '@/lib/rotulos'
import {
  formatarData,
  formatarEuros,
  formatarMesCapitalizado,
} from '@/lib/formatos'

/**
 * Painel do cliente. Tudo o que aparece aqui é filtrado pela RLS: as consultas
 * não levam filtro por pessoa, é a base de dados que só devolve o que é dele.
 */
export async function PainelCliente({ nome }: { nome: string }) {
  const supabase = await criarClienteServidor()

  const [cavalos, pensos, recebimentos] = await Promise.all([
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
    supabase
      .from('recebimentos')
      .select('id, data, valor, tipo, metodo_pagamento, periodo, descricao')
      .order('data', { ascending: false })
      .limit(10),
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

      <div className="grid gap-3 sm:grid-cols-3">
        <Indicador
          rotulo="Os seus cavalos"
          valor={String(cavalos.data?.length ?? 0)}
        />
        <Indicador
          rotulo="Por regularizar"
          valor={formatarEuros(emFalta)}
          tom={emFalta > 0 ? 'negativo' : 'positivo'}
          detalhe={
            emFalta > 0 ? 'Contacte a gestão para regularizar' : 'Tudo em dia'
          }
        />
        <Indicador
          rotulo="Pagamentos registados"
          valor={String(recebimentos.data?.length ?? 0)}
          detalhe="Últimos 10"
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
                      <Td className="text-muted-foreground">
                        {cavalo.raca ?? '—'}
                      </Td>
                      <Td>
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
          <CabecalhoCartao>
            <TituloCartao>Mensalidades por regularizar</TituloCartao>
            <DescricaoCartao>
              Valores de penso ainda não recebidos pelo centro
            </DescricaoCartao>
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
                      <Td className="text-muted-foreground">
                        {linha.cavalo_nome}
                      </Td>
                      <Td numerico className="font-medium">
                        {formatarEuros(linha.valor_em_falta)}
                      </Td>
                    </Linha>
                  ))}
                </Corpo>
              </Tabela>
            ) : (
              <SemRegistos titulo="Não tem nada por regularizar" />
            )}
          </ConteudoCartao>
        </Cartao>

        <Cartao className="xl:col-span-2">
          <CabecalhoCartao>
            <TituloCartao>Os seus pagamentos</TituloCartao>
            <DescricaoCartao>
              Registo interno do centro. Não substitui o recibo emitido pela
              contabilidade.
            </DescricaoCartao>
          </CabecalhoCartao>
          <ConteudoCartao className="px-0 sm:px-0">
            {recebimentos.data && recebimentos.data.length > 0 ? (
              <Tabela>
                <Cabecalho>
                  <Linha>
                    <Th>Data</Th>
                    <Th>Refere-se a</Th>
                    <Th>Método</Th>
                    <Th numerico>Valor</Th>
                  </Linha>
                </Cabecalho>
                <Corpo>
                  {recebimentos.data.map((recebimento) => (
                    <Linha key={recebimento.id}>
                      <Td className="whitespace-nowrap">
                        {formatarData(recebimento.data)}
                      </Td>
                      <Td>
                        {recebimento.descricao ??
                          (recebimento.periodo
                            ? formatarMesCapitalizado(recebimento.periodo)
                            : '—')}
                      </Td>
                      <Td className="text-muted-foreground">
                        {ROTULOS_METODO[recebimento.metodo_pagamento]}
                      </Td>
                      <Td numerico className="font-medium">
                        {formatarEuros(recebimento.valor)}
                      </Td>
                    </Linha>
                  ))}
                </Corpo>
              </Tabela>
            ) : (
              <SemRegistos titulo="Ainda não há pagamentos registados" />
            )}
          </ConteudoCartao>
        </Cartao>
      </div>
    </>
  )
}
