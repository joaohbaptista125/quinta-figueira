/**
 * Molas, projecção de inércia e elástico de bordo.
 * =============================================================================
 *
 * Funções puras. Não tocam no DOM, não sabem o que é um `requestAnimationFrame`
 * e não dependem do browser — é o que as torna testáveis em
 * `lib/mola.test.ts`, e a razão de viverem aqui em vez de dentro do
 * componente que as usa.
 *
 * **Porque é que isto não são transições de CSS.** Uma `transition` tem
 * duração fixa e começa sempre do mesmo sítio: agarrar o painel a meio da
 * animação obrigava a saltar para o valor final, e largar o dedo a 2000 px/s
 * dava exactamente a mesma animação que largar parado. Uma mola sabe de
 * **posição e de velocidade**, por isso pode ser interrompida no fotograma em
 * que está e continuar com a velocidade do dedo.
 *
 * **A mola é resolvida analiticamente, não integrada passo a passo.** Dá o
 * valor exacto em `t` segundos, e isso tem uma consequência prática: um salto
 * de 100 ms num telemóvel a engasgar dá o mesmo resultado que dez passos de
 * 10 ms. Um integrador de Euler divergia nesse caso — e é precisamente nos
 * fotogramas perdidos que se nota.
 *
 * A parametrização é a da Apple (`response` e `dampingFraction`) e não
 * `stiffness`/`damping`: «quanto tempo demora» e «quanto ressalta» são as duas
 * perguntas que se fazem a desenhar, e a conversão faz-se aqui uma vez.
 */

export type ParametrosMola = {
  /**
   * Fracção de amortecimento (ζ).
   *
   * `1` é o amortecimento crítico: chega ao destino o mais depressa possível
   * **sem passar dele**. Abaixo de 1 ressalta. É o valor por omissão de tudo
   * o que não traz inércia do dedo.
   */
  amortecimento: number
  /** Período da mola, em segundos. Grosso modo, «quanto tempo demora». */
  resposta: number
}

/** Mover ou repor uma coisa no sítio: sem ressalto. */
export const MOLA_MOVER: ParametrosMola = { amortecimento: 1, resposta: 0.4 }

/** Gaveta e folha: o valor de origem da Apple para este tipo de superfície. */
export const MOLA_FOLHA: ParametrosMola = { amortecimento: 0.8, resposta: 0.3 }

export type EstadoMola = { posicao: number; velocidade: number }

/**
 * Onde está a mola `dt` segundos depois, e a que velocidade.
 *
 * `dt` é em segundos e `velocidade` em unidades por segundo — as mesmas
 * unidades de `posicao`, que aqui é sempre em píxeis.
 */
export function passoDaMola(
  { amortecimento, resposta }: ParametrosMola,
  estado: EstadoMola,
  alvo: number,
  dt: number,
): EstadoMola {
  if (dt <= 0) return estado

  const w0 = (2 * Math.PI) / resposta
  const z = amortecimento
  const x0 = estado.posicao - alvo
  const v0 = estado.velocidade

  let x: number
  let v: number

  if (z < 1) {
    // Subamortecida: chega ao destino e passa dele antes de assentar.
    const wd = w0 * Math.sqrt(1 - z * z)
    const decaimento = Math.exp(-z * w0 * dt)
    const a = x0
    const b = (v0 + z * w0 * x0) / wd
    const cos = Math.cos(wd * dt)
    const sin = Math.sin(wd * dt)

    x = decaimento * (a * cos + b * sin)
    v =
      decaimento *
      (-z * w0 * (a * cos + b * sin) + wd * (b * cos - a * sin))
  } else if (z === 1) {
    // Crítica: o mais depressa possível sem passar do destino.
    const decaimento = Math.exp(-w0 * dt)
    const c = v0 + w0 * x0

    x = decaimento * (x0 + c * dt)
    v = decaimento * (v0 - w0 * c * dt)
  } else {
    // Sobreamortecida: assenta sem oscilar, mas devagar.
    const raiz = w0 * Math.sqrt(z * z - 1)
    const r1 = -z * w0 + raiz
    const r2 = -z * w0 - raiz
    const c2 = (v0 - r1 * x0) / (r2 - r1)
    const c1 = x0 - c2
    const e1 = Math.exp(r1 * dt)
    const e2 = Math.exp(r2 * dt)

    x = c1 * e1 + c2 * e2
    v = c1 * r1 * e1 + c2 * r2 * e2
  }

  return { posicao: x + alvo, velocidade: v }
}

/** Quando é que já não vale a pena continuar a desenhar fotogramas. */
export function molaAssentou(
  estado: EstadoMola,
  alvo: number,
  toleranciaPosicao = 0.5,
  toleranciaVelocidade = 10,
): boolean {
  return (
    Math.abs(estado.posicao - alvo) < toleranciaPosicao &&
    Math.abs(estado.velocidade) < toleranciaVelocidade
  )
}

/**
 * Onde é que isto ia parar se o largássemos agora.
 *
 * **Isto é o que distingue um gesto que percebe a intenção de um que não
 * percebe.** Decidir pelo sítio onde o dedo largou ignora a velocidade: um
 * puxão curto e rápido para baixo é claramente «fecha isto», mesmo que o
 * painel ainda esteja quase todo no ecrã. O que se compara com o limite é
 * esta projecção, não a posição no instante em que o dedo saiu.
 *
 * A travagem é exponencial (o mesmo modelo do deslize das listas do iOS), e
 * `taxaDeTravagem` é a fracção da velocidade que sobrevive a cada
 * milissegundo. Daí os `0.998`: ao fim de um segundo resta `0.998^1000`, cerca
 * de 13%.
 */
export function repousoProjectado(
  posicao: number,
  velocidade: number,
  taxaDeTravagem = 0.998,
): number {
  return (
    posicao + (velocidade / 1000) * (taxaDeTravagem / (1 - taxaDeTravagem))
  )
}

/**
 * O elástico do bordo: quanto é que uma coisa anda quando já não devia andar.
 *
 * Puxar uma folha para cima quando ela já está toda aberta não pode
 * simplesmente não fazer nada — um batente seco lê-se como «a aplicação
 * encravou». O que se faz é deixá-la ir, cada vez menos, até um limite.
 *
 * `excesso` é o quanto se passou do bordo, `dimensao` o tamanho da superfície
 * e `coeficiente` a dureza do elástico (0,55 é o valor do iOS).
 *
 * O resultado **nunca chega a `dimensao`**, por muito que se puxe: é essa a
 * assímptota. Na prática o que se sente é outra coisa — puxar o equivalente à
 * superfície inteira anda `c / (1 + c)` dela, uns 35% com o coeficiente de
 * origem. O `coeficiente` não é o tecto, é a rapidez com que se lá chega.
 */
export function elastico(
  excesso: number,
  dimensao: number,
  coeficiente = 0.55,
): number {
  const sinal = Math.sign(excesso)
  const x = Math.abs(excesso)
  return (sinal * (x * dimensao * coeficiente)) / (dimensao + coeficiente * x)
}
