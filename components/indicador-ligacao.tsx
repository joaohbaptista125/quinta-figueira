'use client'

import { useEffect, useState } from 'react'

/**
 * Barra de aviso quando o dispositivo perde a rede.
 *
 * Na cavalariça a cobertura falha, e um formulário submetido sem rede não
 * chega ao servidor. Mais vale avisar antes de a pessoa escrever tudo do que
 * deixá-la descobrir com um erro no fim.
 */
export function IndicadorLigacao() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const actualizar = () => setOffline(!navigator.onLine)
    actualizar()
    window.addEventListener('online', actualizar)
    window.addEventListener('offline', actualizar)
    return () => {
      window.removeEventListener('online', actualizar)
      window.removeEventListener('offline', actualizar)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      className="sticky top-0 z-30 bg-warning px-3 py-1.5 text-center text-xs font-medium text-warning-foreground"
    >
      Sem ligação à internet — o que gravar agora não chega ao servidor.
    </div>
  )
}
