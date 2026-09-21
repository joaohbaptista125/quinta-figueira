import type { Metadata } from 'next'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { exigirGestao } from '@/lib/sessao'
import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import { ErroConsulta } from '@/components/erro-consulta'
import { AdicionarOpcao, LinhaOpcao, type Opcao } from '@/components/opcoes-cavalo'
import {
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  SemRegistos,
  TituloCartao,
} from '@/components/ui/superficie'
import {
  ROTULOS_TIPO_OPCAO_PLURAL,
  TIPOS_OPCAO,
} from '@/lib/opcoes-cavalo'
import type { TipoOpcaoCavalo } from '@/lib/tipos-bd'

export const metadata: Metadata = { title: 'Raças e pelagens' }

const DESCRICOES: Record<TipoOpcaoCavalo, string> = {
  raca: 'O que aparece na lista de raças da ficha do cavalo.',
  pelagem: 'O que aparece na lista de pelagens da ficha do cavalo.',
}

/**
 * As listas que o formulário do cavalo oferece.
 *
 * Existe por causa do engano: uma raça escrita à mão entra na lista e fica lá
 * para sempre, e sem esta página a única maneira de corrigir um «Lusitno»
 * seria ir ao painel do Supabase. Mudar o nome muda-o também nos cavalos que
 * o usam — ver `renomearOpcaoCavalo`.
 */
export default async function PaginaOpcoesCavalo() {
  await exigirGestao()
  const supabase = await criarClienteServidor()

  const [opcoes, cavalos] = await Promise.all([
    supabase
      .from('opcoes_cavalo')
      .select('id, tipo, valor, activa')
      .order('tipo')
      .order('ordem')
      .order('valor'),
    // Para dizer quantos cavalos usam cada uma. São sessenta linhas de duas
    // colunas: contar aqui poupa uma consulta por opção.
    supabase.from('cavalos').select('raca, pelagem'),
  ])

  if (opcoes.error) {
    return <ErroConsulta erro={opcoes.error} contexto="as raças e pelagens" />
  }

  const usos = { raca: new Map<string, number>(), pelagem: new Map<string, number>() }
  for (const cavalo of cavalos.data ?? []) {
    for (const tipo of TIPOS_OPCAO) {
      const valor = cavalo[tipo]
      if (valor) usos[tipo].set(valor, (usos[tipo].get(valor) ?? 0) + 1)
    }
  }

  return (
    <>
      <CabecalhoPagina
        voltar={{ href: '/cavalos', rotulo: 'Cavalos' }}
        titulo="Raças e pelagens"
        descricao="As listas que aparecem ao criar ou editar um cavalo"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {TIPOS_OPCAO.map((tipo) => {
          const doTipo: Opcao[] = (opcoes.data ?? [])
            .filter((opcao) => opcao.tipo === tipo)
            .map((opcao) => ({
              id: opcao.id,
              valor: opcao.valor,
              activa: opcao.activa,
              usos: usos[tipo].get(opcao.valor) ?? 0,
            }))

          return (
            <Cartao key={tipo}>
              <CabecalhoCartao>
                <TituloCartao>{ROTULOS_TIPO_OPCAO_PLURAL[tipo]}</TituloCartao>
                <DescricaoCartao>{DESCRICOES[tipo]}</DescricaoCartao>
              </CabecalhoCartao>

              <ConteudoCartao className="px-0 sm:px-0">
                {doTipo.length > 0 ? (
                  <ul className="divide-y divide-border border-y border-border">
                    {doTipo.map((opcao) => (
                      <LinhaOpcao key={opcao.id} opcao={opcao} />
                    ))}
                  </ul>
                ) : (
                  <SemRegistos titulo="A lista está vazia" />
                )}

                <div className="px-4 pt-4 sm:px-5">
                  <AdicionarOpcao tipo={tipo} />
                </div>
              </ConteudoCartao>
            </Cartao>
          )
        })}
      </div>

      <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
        Mudar o nome de uma opção muda-o também nos cavalos que a usam. Tirar da
        lista não apaga nada: quem já a tem continua a mostrá-la, ela é que
        deixa de aparecer a quem está a escolher.
      </p>
    </>
  )
}
