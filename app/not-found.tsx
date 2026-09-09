import Link from 'next/link'
import { classesBotao } from '@/components/ui/botao'

export default function NaoEncontrado() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
        404
      </p>
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        O endereço não existe, ou o registo foi apagado — ou não tem permissão
        para o ver.
      </p>
      <Link href="/" className={classesBotao('contorno', 'normal', 'mt-2')}>
        Voltar ao painel
      </Link>
    </main>
  )
}
