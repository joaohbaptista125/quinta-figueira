import Link from 'next/link'

export default function LayoutPublico({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-4">
      <Link href="/" className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Centro Hípico
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Quinta da Figueira
        </h1>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  )
}
