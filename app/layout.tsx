import type { Metadata, Viewport } from 'next'
import './globals.css'
import { RegistarServiceWorker } from '@/components/registar-service-worker'

export const metadata: Metadata = {
  title: {
    default: 'Quinta da Figueira',
    template: '%s · Quinta da Figueira',
  },
  description: 'Gestão do centro hípico Quinta da Figueira',
  manifest: '/manifest.webmanifest',
  applicationName: 'Quinta da Figueira',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Quinta da Figueira',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/icones/icone-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icones/icone-192.png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#2f5b45',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        {children}
        <RegistarServiceWorker />
      </body>
    </html>
  )
}
