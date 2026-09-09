import { CabecalhoPagina } from '@/components/cabecalho-pagina'
import {
  Aviso,
  Cartao,
  ConteudoCartao,
} from '@/components/ui/superficie'
import { traduzirErro } from '@/lib/accoes/resultado'

type ErroPostgrest = {
  message: string
  code?: string
  details?: string | null
  hint?: string | null
}

/**
 * Mostrada quando uma consulta falha ao abrir uma ficha.
 *
 * Antes destas páginas chamarem `notFound()` para tudo, um erro de base de
 * dados era indistinguível de um registo apagado — e o 404 escondia a causa.
 * Aqui a mensagem aparece, com o código do Postgres à vista para quem tiver de
 * a diagnosticar.
 */
export function ErroConsulta({
  erro,
  contexto,
}: {
  erro: ErroPostgrest
  contexto: string
}) {
  return (
    <>
      <CabecalhoPagina
        titulo="Não foi possível abrir"
        descricao={`Falhou a leitura de: ${contexto}`}
      />
      <Cartao className="max-w-2xl">
        <ConteudoCartao className="space-y-3 pt-4 sm:pt-5">
          <Aviso tom="erro">{traduzirErro(erro)}</Aviso>

          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              Detalhe técnico
            </summary>
            <dl className="mt-2 space-y-1 rounded-md bg-muted p-3 text-xs">
              {erro.code ? (
                <Linha rotulo="Código" valor={erro.code} />
              ) : null}
              <Linha rotulo="Mensagem" valor={erro.message} />
              {erro.details ? (
                <Linha rotulo="Detalhes" valor={erro.details} />
              ) : null}
              {erro.hint ? <Linha rotulo="Sugestão" valor={erro.hint} /> : null}
            </dl>
          </details>

          <p className="text-xs text-muted-foreground">
            Se isto se repetir, o código acima é o que permite perceber a causa.
          </p>
        </ConteudoCartao>
      </Cartao>
    </>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 font-medium">{rotulo}:</dt>
      <dd className="break-all font-mono">{valor}</dd>
    </div>
  )
}
