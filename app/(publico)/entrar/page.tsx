import type { Metadata } from 'next'
import { supabaseConfigurado } from '@/lib/supabase/configuracao'
import { ConfiguracaoEmFalta } from '@/components/configuracao-em-falta'
import { Aviso } from '@/components/ui/superficie'
import { FormularioEntrar } from './formulario'

/**
 * Porque é que viemos aqui parar. Sem isto, um link de email que falhasse
 * deixava a pessoa no ecrã de entrada sem uma palavra de explicação — que foi
 * exactamente o que aconteceu com os primeiros convites.
 */
const ERROS: Record<string, string> = {
  link_expirado:
    'Esse link já foi usado ou passou do prazo. Peça à gestão do centro que envie outro.',
  link_invalido:
    'Esse link não está completo. Abra-o tal como veio no email, sem o copiar aos bocados.',
}

export const metadata: Metadata = { title: 'Entrar' }

export default async function PaginaEntrar({
  searchParams,
}: {
  searchParams: Promise<{ seguinte?: string; erro?: string }>
}) {
  if (!supabaseConfigurado) return <ConfiguracaoEmFalta />

  const { seguinte, erro } = await searchParams
  const mensagem = erro ? ERROS[erro] : undefined

  return (
    <div className="space-y-4">
      {mensagem ? <Aviso tom="atencao">{mensagem}</Aviso> : null}
      <FormularioEntrar seguinte={seguinte ?? '/'} />
    </div>
  )
}
