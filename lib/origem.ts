/**
 * Origem pública da aplicação — a que vai nos links enviados por email.
 *
 * Está à parte de `lib/sessao.ts` para poder ser testada: `sessao.ts` importa
 * `next/headers`, que não existe fora de um pedido.
 */

/** Endereços que só existem na máquina de quem está a programar. */
const ANFITRIOES_LOCAIS = ['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0']

function ehLocal(anfitriao: string) {
  const semPorta = anfitriao.replace(/:\d+$/, '').toLowerCase()
  return ANFITRIOES_LOCAIS.includes(semPorta)
}

function anfitriaoDe(url: string) {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

/**
 * Escolhe a origem a partir do que está configurado e do pedido que chegou.
 *
 * `NEXT_PUBLIC_SITE_URL` manda — excepto quando aponta para a máquina local e
 * o pedido veio de um sítio verdadeiro. Isso não é uma hipótese teórica: o
 * `.env.example` traz `http://localhost:3000`, copiar esse ficheiro para as
 * variáveis da Vercel é o caminho mais natural do mundo, e o resultado era um
 * convite com um link para `localhost:3000` na caixa de correio de outra
 * pessoa — que nunca poderia funcionar, e não dizia porquê.
 *
 * Em desenvolvimento nada muda: aí o pedido também vem de localhost.
 */
export function escolherOrigem(
  configurada: string | undefined | null,
  anfitriao: string | null,
  protocolo: string,
): string {
  const limpa = configurada?.trim().replace(/\/$/, '') || null
  const doPedido = anfitriao ? `${protocolo}://${anfitriao}` : null

  if (limpa) {
    const anfitriaoConfigurado = anfitriaoDe(limpa)
    const configuradaELocal = anfitriaoConfigurado
      ? ehLocal(anfitriaoConfigurado)
      : false
    const pedidoEVerdadeiro = anfitriao ? !ehLocal(anfitriao) : false

    // Só se ignora o que está configurado neste caso: aponta para a máquina
    // local e o pedido não veio de lá.
    if (!(configuradaELocal && pedidoEVerdadeiro)) return limpa
  }

  return doPedido ?? limpa ?? 'http://localhost:3000'
}
