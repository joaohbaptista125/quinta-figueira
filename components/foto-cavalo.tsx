import Image from 'next/image'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { Cartao, ConteudoCartao } from '@/components/ui/superficie'

/**
 * O bucket 'cavalos' é privado, por isso a imagem é servida por URL assinado,
 * gerado a cada pedido. Uma hora chega para a duração de uma visita à ficha.
 */
export async function FotoCavalo({
  caminho,
  nome,
}: {
  caminho: string | null
  nome: string
}) {
  if (!caminho) return null

  const supabase = await criarClienteServidor()
  const { data } = await supabase.storage
    .from('cavalos')
    .createSignedUrl(caminho, 60 * 60)

  if (!data?.signedUrl) return null

  return (
    <Cartao className="overflow-hidden">
      <ConteudoCartao className="p-0 sm:p-0">
        <Image
          src={data.signedUrl}
          alt={`Fotografia de ${nome}`}
          width={800}
          height={600}
          className="h-auto w-full object-cover"
          unoptimized
        />
      </ConteudoCartao>
    </Cartao>
  )
}
