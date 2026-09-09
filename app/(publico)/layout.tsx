import Link from 'next/link'
import { Marca } from '@/components/marca'

export default function LayoutPublico({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-4">
      <Link href="/">
        <Marca tamanho="grande" />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  )
}
