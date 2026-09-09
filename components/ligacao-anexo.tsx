import { criarClienteServidor } from '@/lib/supabase/servidor'
import { classesBotao } from '@/components/ui/botao'

/**
 * Link para a fatura digitalizada. O bucket 'documentos' é privado, por isso o
 * URL é assinado a cada visita e expira ao fim de uma hora.
 */
export async function LigacaoAnexo({ caminho }: { caminho: string | null }) {
  if (!caminho) return null

  const supabase = await criarClienteServidor()
  const { data } = await supabase.storage
    .from('documentos')
    .createSignedUrl(caminho, 60 * 60)

  if (!data?.signedUrl) return null

  return (
    <a
      href={data.signedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={classesBotao('contorno', 'pequeno', 'mt-2 w-full')}
    >
      Ver fatura
    </a>
  )
}
