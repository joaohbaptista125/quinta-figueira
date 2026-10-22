import { MapPin } from 'lucide-react'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import {
  estadoDaRegiao,
  medirIdaEVolta,
  nomeDaRegiao,
} from '@/lib/regiao'
import {
  Aviso,
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  Distintivo,
  TituloCartao,
} from '@/components/ui/superficie'

/**
 * Onde o servidor está a correr, e a que distância está a base de dados.
 *
 * Existe porque «a aplicação está lenta» é uma frase que não se resolve a
 * adivinhar. Cada clique é uma renderização no servidor que fala com o
 * Supabase: se os dois estiverem em sítios diferentes, cada ida e volta paga
 * a viagem, e uma página faz várias.
 *
 * **O tempo é medido no momento**, com uma contagem sobre uma tabela pequena
 * que não devolve linhas — o que se mede é a viagem, não o trabalho da base.
 * Três medições, fica a melhor: a pior de três diz mais sobre o instante do
 * que sobre a distância.
 *
 * Só para a gestão. Não é segredo nenhum, mas a um cliente é ruído.
 */
export async function OndeEstaACorrer() {
  const regiao = estadoDaRegiao()
  const supabase = await criarClienteServidor()

  const idaEVolta = await medirIdaEVolta(() =>
    supabase.from('contas').select('id', { head: true, count: 'exact' }),
  )

  return (
    <Cartao className="h-fit">
      <CabecalhoCartao>
        <TituloCartao className="flex items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" aria-hidden />
          Onde isto está a correr
        </TituloCartao>
        <DescricaoCartao>
          Cada clique é uma renderização no servidor que fala com a base de
          dados. Quanto mais longe uma da outra, mais lento parece.
        </DescricaoCartao>
      </CabecalhoCartao>

      <ConteudoCartao className="space-y-3">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Servidor</dt>
            <dd className="font-medium">
              {regiao.veredicto === 'local'
                ? 'A correr localmente'
                : nomeDaRegiao(regiao.actual)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Ida e volta à base de dados
            </dt>
            <dd className="tabular font-medium">
              {idaEVolta === null ? '—' : `${idaEVolta} ms`}
            </dd>
          </div>
        </dl>

        {regiao.veredicto === 'diferente' ? (
          <Aviso tom="atencao">
            <strong>O servidor não está onde devia.</strong> Está em{' '}
            {nomeDaRegiao(regiao.actual)} e devia estar em{' '}
            {nomeDaRegiao(regiao.esperada)}, que é onde vive a base de dados.
            Cada ida e volta paga a viagem, e uma página faz várias. Confirme a
            região das funções nas definições do projecto na Vercel.
          </Aviso>
        ) : regiao.veredicto === 'igual' ? (
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <Distintivo cor="sucesso">Na região certa</Distintivo>
            O servidor e a base de dados estão os dois em{' '}
            {nomeDaRegiao(regiao.esperada)}.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Fora da Vercel não há região para comparar. O tempo acima é o desta
            máquina até ao Supabase.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Com o servidor e a base na mesma região, uma ida e volta anda pelos
          poucos milissegundos. Muito acima disso, ou estão em regiões
          diferentes, ou é a função a arrancar fria — e isso nota-se sobretudo
          na primeira página depois de um tempo sem ninguém lá entrar.
        </p>
      </ConteudoCartao>
    </Cartao>
  )
}
