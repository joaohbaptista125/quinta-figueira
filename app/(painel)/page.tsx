import { exigirPessoa } from '@/lib/sessao'
import { eGestao } from '@/lib/permissoes'
import { PainelGestao } from './painel-gestao'
import { PainelCliente } from './painel-cliente'
import { PainelEquipa } from './painel-equipa'
import { primeiroDiaDoMes } from '@/lib/formatos'

export default async function PaginaPainel({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const pessoa = await exigirPessoa()
  const { mes } = await searchParams
  const periodo = mes ? primeiroDiaDoMes(`${mes}-01`) : primeiroDiaDoMes()

  if (eGestao(pessoa.perfil)) {
    return <PainelGestao periodo={periodo} nome={pessoa.nome} />
  }

  if (pessoa.perfil === 'cliente') {
    return <PainelCliente nome={pessoa.nome} />
  }

  return <PainelEquipa nome={pessoa.nome} />
}
