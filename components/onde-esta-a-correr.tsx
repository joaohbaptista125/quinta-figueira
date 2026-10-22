import { MapPin } from 'lucide-react'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import {
  estadoDaInstancia,
  estadoDaRegiao,
  lerAssinatura,
  medirIdaEVolta,
  nomeDaRegiao,
} from '@/lib/diagnostico'
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
  const instancia = estadoDaInstancia()
  const supabase = await criarClienteServidor()

  // Os dois serviços medidos à parte, de propósito. O Postgres pode estar ao
  // lado e o servidor de autenticação continuar a custar uma viagem — e é por
  // lá que passa o caminho da sessão, duas vezes por navegação.
  const dados = await medirIdaEVolta(() =>
    supabase.from('contas').select('id', { head: true, count: 'exact' }),
  )
  // Cliente novo a cada medição, de propósito: reutilizar o mesmo media a
  // memória dele e não a rede. Era por isso que a autenticação dizia 0 ms.
  const autenticacao = await medirIdaEVolta(async () => {
    const cliente = await criarClienteServidor()
    return cliente.auth.getUser()
  })

  // Como o projecto assina os tokens, lido do cabeçalho do próprio token. É
  // um facto, não uma comparação de tempos.
  const { data: sessao } = await supabase.auth.getSession()
  const assinatura = lerAssinatura(sessao.session?.access_token)

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
              Esta instância já serviu
            </dt>
            <dd className="font-medium">
              {instancia.acabouDeArrancar
                ? `acabou de arrancar — tem ${instancia.idadeSegundos}s`
                : `${instancia.servidos} pedidos, há ${instancia.idadeSegundos}s`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Ida e volta aos dados
            </dt>
            <dd className="tabular font-medium">
              {dados === null ? '—' : `${dados} ms`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Ida e volta à autenticação
            </dt>
            <dd className="tabular font-medium">
              {autenticacao === null ? '—' : `${autenticacao} ms`}
              <span className="font-normal text-muted-foreground">
                {assinatura === 'assimetrica'
                  ? ' · verificada aqui'
                  : assinatura === 'simetrica'
                    ? ' · verificada lá'
                    : ''}
              </span>
            </dd>
          </div>
        </dl>

        {instancia.acabouDeArrancar ? (
          <Aviso tom="atencao">
            <strong>Este acesso apanhou a função a arrancar.</strong> Quando
            ninguém entra na aplicação durante uns minutos, o servidor é criado
            de novo no acesso seguinte, e essa primeira página é sempre a mais
            lenta — os números aqui em cima já são de um servidor a trabalhar.
            Se vir isto quase sempre que abre a aplicação, é esta a razão de
            «lenta a abrir», e não a base de dados.
          </Aviso>
        ) : null}

        {assinatura === 'simetrica' ? (
          <Aviso tom="atencao">
            <strong>A sessão é verificada pelo servidor do Supabase</strong>, e
            isso acontece duas vezes por navegação — custe o que custar o número
            acima. Com as chaves assimétricas ligadas em Authentication → JWT
            Keys, passa a ser verificada aqui mesmo, sem rede.
          </Aviso>
        ) : null}

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
          Como ler isto: na mesma região, os <strong>dados</strong> andam pelos
          poucos milissegundos. A <strong>autenticação</strong> é outro serviço
          e costuma custar mais — e está no caminho de cada navegação, duas
          vezes. E se <strong>«acabou de arrancar»</strong> aparecer quase
          sempre que abre a aplicação, a lentidão de abrir é o arranque, e não
          a rede.
        </p>
      </ConteudoCartao>
    </Cartao>
  )
}
