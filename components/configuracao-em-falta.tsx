import {
  Aviso,
  Cartao,
  CabecalhoCartao,
  ConteudoCartao,
  DescricaoCartao,
  TituloCartao,
} from '@/components/ui/superficie'

/**
 * Mostrada enquanto as chaves do Supabase forem os valores de exemplo.
 * Evita que a aplicação rebente com erros de rede antes de estar ligada.
 *
 * As instruções mudam conforme o sítio onde está a correr: mandar quem vê isto
 * num site publicado criar um `.env.local` é mandá-lo ao sítio errado — esse
 * ficheiro nem sequer existe no servidor.
 */
export function ConfiguracaoEmFalta() {
  // A Vercel define VERCEL=1 em todos os deployments.
  const naVercel = process.env.VERCEL === '1'

  return (
    <Cartao>
      <CabecalhoCartao>
        <TituloCartao>Falta ligar ao Supabase</TituloCartao>
        <DescricaoCartao>
          A aplicação está a correr com valores de exemplo.
        </DescricaoCartao>
      </CabecalhoCartao>

      <ConteudoCartao className="space-y-3 text-sm">
        {naVercel ? <InstrucoesVercel /> : <InstrucoesLocais />}
      </ConteudoCartao>
    </Cartao>
  )
}

function InstrucoesVercel() {
  return (
    <>
      <p>
        No painel da Vercel, em{' '}
        <strong>Settings → Environment Variables</strong>, defina:
      </p>
      <Variaveis />
      <p className="text-muted-foreground">
        Os dois valores estão em <strong>Project Settings → API</strong>, no
        painel do Supabase. Se aí aparecer <em>Publishable key</em> em vez de{' '}
        <em>anon public</em>, use essa — serve para o mesmo.
      </p>
      <Aviso tom="atencao">
        <strong>Depois é preciso voltar a fazer deploy.</strong> Estas variáveis
        são fixadas no momento em que o projecto compila, por isso guardá-las
        sozinho não muda nada: <strong>Deployments → ⋯ → Redeploy</strong>.
      </Aviso>
    </>
  )
}

function InstrucoesLocais() {
  return (
    <>
      <p>
        Crie o ficheiro{' '}
        <code className="rounded bg-muted px-1">.env.local</code> na raiz do
        projecto (a partir de{' '}
        <code className="rounded bg-muted px-1">.env.example</code>) com:
      </p>
      <Variaveis />
      <p className="text-muted-foreground">
        Os dois valores estão em <strong>Project Settings → API</strong>, no
        painel do Supabase. Depois reinicie o servidor de desenvolvimento — as
        variáveis só são lidas no arranque.
      </p>
      <Aviso tom="atencao">
        Num site publicado (Vercel), as mesmas variáveis vão em{' '}
        <strong>Settings → Environment Variables</strong>, e é preciso voltar a
        fazer deploy para terem efeito.
      </Aviso>
    </>
  )
}

function Variaveis() {
  return (
    <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
      {`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`}
    </pre>
  )
}
