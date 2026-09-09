import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Quinta da Figueira — Gestão',
    short_name: 'Quinta da Figueira',
    description:
      'Gestão do centro hípico Quinta da Figueira: cavalos, pessoas, pensos e financeiro.',
    lang: 'pt-PT',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f7f5f0',
    theme_color: '#2f5b45',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icones/icone-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icones/icone-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icones/icone-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Lançar despesa',
        short_name: 'Despesa',
        url: '/financeiro/despesas/nova',
      },
      {
        name: 'Registar recebimento',
        short_name: 'Recebimento',
        url: '/financeiro/recebimentos/novo',
      },
    ],
  }
}
