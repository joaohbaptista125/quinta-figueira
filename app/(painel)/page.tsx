import { exigirPessoa } from '@/lib/sessao'
import { eGestao } from '@/lib/permissoes'
import { PainelGestao } from './painel-gestao'
import { PainelCliente } from './painel-cliente'
import { PainelEquipa } from './painel-equipa'

export default async function PaginaPainel() {
  const pessoa = await exigirPessoa()

  if (eGestao(pessoa.perfil)) {
    return <PainelGestao nome={pessoa.nome} />
  }

  if (pessoa.perfil === 'cliente') {
    return <PainelCliente nome={pessoa.nome} />
  }

  return <PainelEquipa nome={pessoa.nome} />
}
