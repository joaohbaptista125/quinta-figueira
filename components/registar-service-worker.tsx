'use client'

import { useEffect } from 'react'

/**
 * Regista o service worker que dá à PWA a capacidade de abrir sem rede.
 * Fica desligado em desenvolvimento para não servir versões em cache do build.
 */
export function RegistarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const registar = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Sem service worker a aplicação continua a funcionar com rede.
      })
    }

    if (document.readyState === 'complete') registar()
    else window.addEventListener('load', registar, { once: true })
  }, [])

  return null
}
