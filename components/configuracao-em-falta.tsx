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
 */
export function ConfiguracaoEmFalta() {
  return (
    <Cartao>
      <CabecalhoCartao>
        <TituloCartao>Falta ligar ao Supabase</TituloCartao>
        <DescricaoCartao>
          A aplicação está a correr com valores de exemplo.
        </DescricaoCartao>
      </CabecalhoCartao>
      <ConteudoCartao className="space-y-3 text-sm">
        <p>
          Crie o ficheiro <code className="rounded bg-muted px-1">.env.local</code>{' '}
          na raiz do projecto (a partir de{' '}
          <code className="rounded bg-muted px-1">.env.example</code>) com:
        </p>
        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
          {`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`}
        </pre>
        <p className="text-muted-foreground">
          Encontra os dois valores em <strong>Project Settings → API</strong> no
          painel do Supabase. Depois reinicie o servidor de desenvolvimento.
        </p>
        <Aviso tom="atencao">
          Em produção (Vercel), as mesmas variáveis têm de estar em{' '}
          <strong>Settings → Environment Variables</strong>.
        </Aviso>
      </ConteudoCartao>
    </Cartao>
  )
}
