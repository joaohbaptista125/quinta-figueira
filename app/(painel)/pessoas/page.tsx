import type { Metadata } from 'next'
import Link from 'next/link'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirEquipa } from '@/lib/sessao'
import { eGestao } from '@/lib/permissoes'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { Pesquisa } from '@/components/pesquisa'
import { AlternarFiltro, FiltroPastilhas } from '@/components/filtros'
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
import { ROTULOS_PAPEL, ROTULOS_PERFIL } from '@/lib/rotulos'
import { formatarEuros } from '@/lib/formatos'
import type { PapelPessoa } from '@/lib/tipos-bd'

export const metadata: Metadata = { title: 'Pessoas' }

export default async function PaginaPessoas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; papel?: string; inactivos?: string }>
}) {
  const sessao = await exigirEquipa()
  const { q, papel, inactivos } = await searchParams
  const supabase = await criarClienteServidor()

  /*
   * Filtrar por papel é a pergunta que uma lista de oitenta fichas mais
   * pede: «quem são os proprietários», «quem são os alunos». `pessoa_papeis`
   * é N:N, por isso não dá para o pôr num `eq` sobre `pessoas` — vai-se
   * primeiro buscar os ids. É mais uma ida à base, a 0–1 ms, e evita um
   * `!inner` que mudava a forma do `select` aninhado.
   *
   * O parâmetro vem do endereço: só é aceite se for mesmo um dos papéis.
   */
  let idsComPapel: string[] | null = null
  if (papel && papel in ROTULOS_PAPEL) {
    const { data } = await supabase
      .from('pessoa_papeis')
      .select('pessoa_id')
      .eq('papel', papel as PapelPessoa)
    idsComPapel = (data ?? []).map((linha) => linha.pessoa_id)
  }

  let consulta = supabase
    .from('pessoas')
    .select('id, nome, email, telefone, activo, perfil, pessoa_papeis(papel)')
    .order('nome')

  if (inactivos !== '1') consulta = consulta.eq('activo', true)
  // Sem ninguém com esse papel, a lista é vazia — e não a lista toda.
  if (idsComPapel) consulta = consulta.in('id', idsComPapel)
  if (q) {
    const termo = `%${q}%`
    const condicoes = [
      `nome.ilike.${termo}`,
      `email.ilike.${termo}`,
      `telefone.ilike.${termo}`,
    ]

    /*
     * O NIF mudou-se para `pessoas_reservado` — procura-se lá e juntam-se os
     * ids. Só para a gestão: a quem não é, a RLS devolveria zero de qualquer
     * maneira, e assim poupa-se a ida à base.
     */
    if (eGestao(sessao.perfil)) {
      const { data: porNif } = await supabase
        .from('pessoas_reservado')
        .select('pessoa_id')
        .ilike('nif', termo)

      const ids = (porNif ?? []).map((linha) => linha.pessoa_id)
      // `in.()` com a lista vazia é sintaxe inválida no PostgREST.
      if (ids.length > 0) condicoes.push(`id.in.(${ids.join(',')})`)
    }

    consulta = consulta.or(condicoes.join(','))
  }

  const { data: pessoas, error } = await consulta

  /*
   * Quem deve, e quanto. A gestão abre esta lista para cobrar tanto como para
   * consultar contactos, e sem isto tinha de entrar pessoa a pessoa para
   * descobrir. É uma leitura da vista inteira, não uma por linha: são umas
   * centenas de mensalidades, somam-se aqui.
   */
  const emDivida = new Map<string, number>()
  if (eGestao(sessao.perfil)) {
    const { data: pensos } = await supabase
      .from('v_pensos_por_receber')
      .select('cliente_id, valor_em_falta')
      .neq('estado', 'paga')

    for (const linha of pensos ?? []) {
      const falta = Number(linha.valor_em_falta)
      if (falta > 0) {
        emDivida.set(linha.cliente_id, (emDivida.get(linha.cliente_id) ?? 0) + falta)
      }
    }
  }

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
        <FiltroPastilhas
          rotulo="Papel"
          parametro="papel"
          opcoes={[
            { rotulo: 'Todos' },
            ...Object.entries(ROTULOS_PAPEL).map(([valor, rotulo]) => ({
              valor,
              // «Jogador de Horseball» não cabe numa pastilha de telemóvel.
              rotulo: valor === 'jogador_horseball' ? 'Horseball' : rotulo,
            })),
          ]}
        />
        <AlternarFiltro
          parametro="inactivos"
          rotuloLigado="Mostrar só activos"
          rotuloDesligado="Incluir inactivos"
        />
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
                {eGestao(sessao.perfil) ? <Th numerico>Pensos</Th> : null}
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
                  <Td rotulo="Contactos" className="text-muted-foreground">
                    <div className="flex flex-col text-xs">
                      {pessoa.email ? <span>{pessoa.email}</span> : null}
                      {pessoa.telefone ? <span>{pessoa.telefone}</span> : null}
                      {!pessoa.email && !pessoa.telefone ? <span>—</span> : null}
                    </div>
                  </Td>
                  <Td rotulo="Papéis">
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
                  <Td rotulo="Acesso" className="text-muted-foreground">
                    {pessoa.perfil ? ROTULOS_PERFIL[pessoa.perfil] : '—'}
                  </Td>
                  {eGestao(sessao.perfil) ? (
                    <Td rotulo="Pensos" numerico>
                      {emDivida.has(pessoa.id) ? (
                        <LigacaoInterna
                          href={`/pessoas/${pessoa.id}/pensos`}
                          className="font-medium text-destructive"
                        >
                          {formatarEuros(emDivida.get(pessoa.id))} em dívida
                        </LigacaoInterna>
                      ) : (
                        <LigacaoInterna
                          href={`/pessoas/${pessoa.id}/pensos`}
                          className="text-muted-foreground"
                        >
                          Pensos e encargos
                        </LigacaoInterna>
                      )}
                    </Td>
                  ) : null}
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
