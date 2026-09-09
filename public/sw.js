/*
 * Service worker da Quinta da Figueira.
 *
 * Objectivo: a aplicação abrir na cavalariça com rede fraca ou nenhuma. Não
 * tenta guardar escritas em fila — um lançamento feito offline seria uma
 * promessa que não podemos cumprir sem conflitos. Em vez disso a aplicação
 * avisa que está sem rede (ver components/indicador-ligacao.tsx).
 *
 * Estratégias:
 *   - navegações  → rede primeiro, cache depois, página de emergência no fim
 *   - /_next/static, ícones → cache primeiro (têm hash no nome, nunca mudam)
 *   - tudo o resto (APIs, Supabase, POST) → passa directo, sem cache
 */

const VERSAO = 'qf-v1'
const CACHE_ESTATICO = `${VERSAO}-estatico`
const CACHE_PAGINAS = `${VERSAO}-paginas`
const PAGINA_EMERGENCIA = '/offline.html'

const PRE_CARREGAR = [
  PAGINA_EMERGENCIA,
  '/icones/icone-192.png',
  '/icones/icone-512.png',
  '/manifest.webmanifest',
]

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_ESTATICO)
      .then((cache) => cache.addAll(PRE_CARREGAR))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(
          nomes
            .filter((nome) => !nome.startsWith(VERSAO))
            .map((nome) => caches.delete(nome)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function ehEstatico(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icones/')
  )
}

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request
  const url = new URL(pedido.url)

  // Só GET do próprio domínio. Escritas e chamadas ao Supabase passam directo.
  if (pedido.method !== 'GET' || url.origin !== self.location.origin) return

  if (ehEstatico(url)) {
    evento.respondWith(
      caches.match(pedido).then(
        (emCache) =>
          emCache ||
          fetch(pedido).then((resposta) => {
            if (resposta.ok) {
              const copia = resposta.clone()
              caches.open(CACHE_ESTATICO).then((cache) => cache.put(pedido, copia))
            }
            return resposta
          }),
      ),
    )
    return
  }

  if (pedido.mode === 'navigate') {
    evento.respondWith(
      fetch(pedido)
        .then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone()
            caches.open(CACHE_PAGINAS).then((cache) => cache.put(pedido, copia))
          }
          return resposta
        })
        .catch(async () => {
          const emCache = await caches.match(pedido)
          if (emCache) return emCache
          const emergencia = await caches.match(PAGINA_EMERGENCIA)
          return (
            emergencia ||
            new Response('Sem ligação.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          )
        }),
    )
  }
})
