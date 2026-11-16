'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  elastico,
  molaAssentou,
  MOLA_FOLHA,
  MOLA_MOVER,
  passoDaMola,
  repousoProjectado,
  type EstadoMola,
} from '@/lib/mola'

/**
 * Uma folha que sobe de baixo, e que se agarra.
 * =============================================================================
 *
 * O painel «Mais» da barra de baixo aparecia e desaparecia de repente: sem
 * entrada, sem saída, e sem maneira de o mandar embora senão acertando no
 * «X». Num telemóvel, uma superfície que vem de baixo pede para ser empurrada
 * de volta — e não o deixar fazer é a diferença entre uma coisa que responde
 * e uma que apenas acontece.
 *
 * O que aqui está, e porquê:
 *
 * **Segue o dedo a 1:1, e guarda a pega.** O ponto onde se tocou fica debaixo
 * do dedo; não há salto no primeiro fotograma. É o mínimo para aquilo parecer
 * um objecto e não um vídeo.
 *
 * **Interrompe-se em qualquer fotograma.** A mola é lida da posição **viva**,
 * não de um destino: pousar o dedo a meio de uma animação agarra-a onde ela
 * está, e com a velocidade que ela leva. Por isso a posição vive numa `ref` e
 * é escrita directamente no `style` — passar por estado de React a 60 fps
 * seria mais lento e, pior, poria um fotograma entre o dedo e a superfície.
 *
 * **O que decide ao largar é a projecção, não a posição.** Um puxão curto e
 * rápido para baixo é «fecha isto», mesmo com a folha ainda quase toda no
 * ecrã — ver `repousoProjectado` em `lib/mola.ts`.
 *
 * **A velocidade do dedo passa para a mola.** Largar a 2000 px/s e largar
 * parado não podem dar a mesma animação.
 *
 * **Ressalto só quando o gesto o trouxe.** Por omissão a mola é crítica
 * (`MOLA_MOVER`, ζ=1): abrir com um toque não deve abanar. Quando o dedo
 * largou com velocidade a sério passa a `MOLA_FOLHA` (ζ=0,8) — aí o ressalto
 * é a inércia que a pessoa imprimiu, e não um enfeite da aplicação.
 *
 * **Puxar para cima dá elástico, não batente.** Um batente seco lê-se como
 * «encravou».
 *
 * **O escurecimento acompanha a posição**, por isso a meio do gesto já se vê
 * para onde aquilo vai — e reverter o gesto reverte também o fundo.
 *
 * **Com «menos movimento» ligado não há mola nenhuma**: abre e fecha de
 * imediato. A regra global de CSS não chega aqui, porque isto é
 * `requestAnimationFrame` e não uma transição.
 *
 * **Arrasta-se pelo cabeçalho, não pelo conteúdo** — e isso é deliberado. Para
 * o conteúdo também arrastar era preciso tirar ao browser o deslize nativo da
 * lista e reimplementá-lo; o que se ganhava não pagava um deslize pior numa
 * lista que é o que ali está. A pega existe precisamente para dizer onde é
 * que se pega.
 *
 * Só translação e opacidade são animadas — nada que obrigue o browser a
 * recalcular a disposição da página.
 */

/** Acima disto, o gesto trouxe inércia a sério e o ressalto é dela. */
const VELOCIDADE_COM_INERCIA = 600

/** Fracção da altura a partir da qual a projecção manda fechar. */
const FRACCAO_PARA_FECHAR = 0.35

/** O gesto só começa a seguir o dedo depois disto — evita roubar toques. */
const FOLGA_ANTES_DE_ARRASTAR = 10

function menosMovimento() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function Folha({
  aberta,
  aoFechar,
  rotulo,
  cabecalho,
  children,
  className,
}: {
  aberta: boolean
  aoFechar: () => void
  /** Nome acessível do diálogo. */
  rotulo: string
  /** Vai dentro da zona que se arrasta, por baixo da pega. */
  cabecalho?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  // Fica montada enquanto fecha: sem isto não havia saída nenhuma para animar.
  const [montada, setMontada] = React.useState(aberta)

  const painel = React.useRef<HTMLDivElement>(null)
  const escurecimento = React.useRef<HTMLDivElement>(null)

  /** Deslocamento para baixo, em píxeis. 0 = aberta, altura = fora do ecrã. */
  const deslocamento = React.useRef(0)
  const velocidade = React.useRef(0)
  const quadro = React.useRef<number | null>(null)
  const altura = React.useRef(0)

  const gesto = React.useRef<{
    id: number
    inicioY: number
    inicioDeslocamento: number
    ultimoY: number
    ultimoT: number
    aArrastar: boolean
  } | null>(null)

  /** Escreve a posição no DOM. É o único sítio que o faz. */
  const pintar = React.useCallback(() => {
    const total = altura.current || 1
    const y = deslocamento.current
    if (painel.current) {
      painel.current.style.transform = `translate3d(0, ${y}px, 0)`
    }
    if (escurecimento.current) {
      escurecimento.current.style.opacity = String(
        Math.max(0, Math.min(1, 1 - y / total)),
      )
    }
  }, [])

  const pararMola = React.useCallback(() => {
    if (quadro.current !== null) {
      cancelAnimationFrame(quadro.current)
      quadro.current = null
    }
  }, [])

  const animarAte = React.useCallback(
    (alvo: number, comInercia: boolean, aoAssentar?: () => void) => {
      pararMola()

      if (menosMovimento()) {
        deslocamento.current = alvo
        velocidade.current = 0
        pintar()
        aoAssentar?.()
        return
      }

      const parametros = comInercia ? MOLA_FOLHA : MOLA_MOVER
      let anterior = performance.now()

      const passo = (agora: number) => {
        // Travado a 64 ms: uma aba que esteve escondida não devolve a mola ao
        // destino de um salto só.
        const dt = Math.min((agora - anterior) / 1000, 0.064)
        anterior = agora

        const estado: EstadoMola = {
          posicao: deslocamento.current,
          velocidade: velocidade.current,
        }
        const seguinte = passoDaMola(parametros, estado, alvo, dt)
        deslocamento.current = seguinte.posicao
        velocidade.current = seguinte.velocidade
        pintar()

        if (molaAssentou(seguinte, alvo)) {
          deslocamento.current = alvo
          velocidade.current = 0
          pintar()
          quadro.current = null
          aoAssentar?.()
          return
        }
        quadro.current = requestAnimationFrame(passo)
      }

      quadro.current = requestAnimationFrame(passo)
    },
    [pararMola, pintar],
  )

  // --- Abrir e fechar -------------------------------------------------------

  React.useEffect(() => {
    if (aberta) setMontada(true)
  }, [aberta])

  React.useEffect(() => {
    if (!montada) return

    altura.current = painel.current?.offsetHeight ?? 0

    if (aberta) {
      // Entra sempre pelo mesmo caminho por onde sai.
      deslocamento.current = altura.current
      velocidade.current = 0
      pintar()
      animarAte(0, false)
    } else {
      animarAte(
        altura.current,
        Math.abs(velocidade.current) > VELOCIDADE_COM_INERCIA,
        () => setMontada(false),
      )
    }

    return pararMola
  }, [aberta, montada, animarAte, pararMola, pintar])

  // Enquanto está aberta, o corpo não desliza por baixo.
  React.useEffect(() => {
    if (!montada) return
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = anterior
    }
  }, [montada])

  React.useEffect(() => {
    if (!montada) return
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [montada, aoFechar])

  // --- O gesto --------------------------------------------------------------

  /*
   * Os ouvintes do gesto vivem na **janela**, e não no elemento.
   *
   * A primeira versão só os punha no painel e chamava `setPointerCapture`
   * depois da folga dos 10px — e isso tinha um nó: arrastar **para cima**
   * tirava o dedo de cima da folha antes de o gesto ter começado, por isso
   * nunca chegava nenhum `pointermove` para o começar. O elástico do bordo
   * simplesmente não existia, e foi assim que se apanhou.
   *
   * Capturar logo no `pointerdown` resolvia o movimento mas partia outra
   * coisa: com o ponteiro capturado, o `click` passa a ser entregue ao
   * elemento que capturou e o «X» lá dentro deixava de responder. A janela
   * não tem nenhum destes problemas.
   */
  const aoPousar = (evento: React.PointerEvent) => {
    if (evento.pointerType === 'mouse' && evento.button !== 0) return

    // Agarrar a meio da animação: fica-se com o fotograma que está no ecrã, e
    // com a velocidade que ele levava.
    pararMola()

    const g = {
      id: evento.pointerId,
      inicioY: evento.clientY,
      inicioDeslocamento: deslocamento.current,
      ultimoY: evento.clientY,
      ultimoT: evento.timeStamp,
      aArrastar: false,
    }
    gesto.current = g

    const aoMover = (e: PointerEvent) => {
      if (e.pointerId !== g.id) return
      const percorrido = e.clientY - g.inicioY

      if (!g.aArrastar) {
        if (Math.abs(percorrido) < FOLGA_ANTES_DE_ARRASTAR) return
        g.aArrastar = true
      }

      const dt = (e.timeStamp - g.ultimoT) / 1000
      if (dt > 0) velocidade.current = (e.clientY - g.ultimoY) / dt
      g.ultimoY = e.clientY
      g.ultimoT = e.timeStamp

      // A pega fica debaixo do dedo onde se lhe tocou — daí somar ao
      // deslocamento de partida em vez de partir de zero.
      const cru = g.inicioDeslocamento + percorrido
      deslocamento.current = cru < 0 ? elastico(cru, altura.current || 1) : cru
      pintar()
    }

    const aoLargar = (e: PointerEvent) => {
      if (e.pointerId !== g.id) return
      window.removeEventListener('pointermove', aoMover)
      window.removeEventListener('pointerup', aoLargar)
      window.removeEventListener('pointercancel', aoLargar)
      gesto.current = null

      const total = altura.current || 1

      /*
       * Pousar o dedo pára a mola. Se o gesto acabar sem nunca ter passado a
       * folga, **é preciso voltar a largá-la** — senão a folha ficava
       * encravada no fotograma em que foi agarrada, a meio do ecrã, para
       * sempre. Apanhado a conduzir isto no browser: tocar na pega a meio da
       * abertura deixava-a a meio.
       */
      if (!g.aArrastar) {
        animarAte(aberta ? 0 : total, false, aberta ? undefined : () => setMontada(false))
        return
      }
      const projeccao = repousoProjectado(
        deslocamento.current,
        velocidade.current,
      )
      const comInercia = Math.abs(velocidade.current) > VELOCIDADE_COM_INERCIA

      if (projeccao > total * FRACCAO_PARA_FECHAR) {
        animarAte(total, comInercia, () => {
          setMontada(false)
          aoFechar()
        })
      } else {
        animarAte(0, comInercia)
      }
    }

    window.addEventListener('pointermove', aoMover)
    window.addEventListener('pointerup', aoLargar)
    window.addEventListener('pointercancel', aoLargar)
  }

  if (!montada) return null

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      {/*
        * Escurecer e desfocar o que está por trás, em vez de pôr vidro sobre
        * vidro: as duas barras de navegação já são translúcidas, e uma
        * terceira camada translúcida por cima delas dava uma sopa onde não se
        * distingue o que está activo. A regra aqui é separar — o fundo
        * afasta-se, a folha é opaca.
        *
        * Fecha no `pointerdown` e não no `click`: a resposta é a descer o
        * dedo, não a levantá-lo.
        */}
      <div
        ref={escurecimento}
        aria-hidden="true"
        onPointerDown={aoFechar}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        style={{ opacity: 0 }}
      />

      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-label={rotulo}
        className={cn(
          'absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col',
          'rounded-t-2xl border-t border-border bg-card shadow-2xl',
          className,
        )}
        style={{
          transform: 'translate3d(0, 100%, 0)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/*
          * A zona que se arrasta. `touch-none` tira ao browser o gesto
          * vertical **só aqui** — no conteúdo lá de baixo o deslize continua a
          * ser dele, que é o que faz uma lista comportar-se como uma lista.
          */}
        <div
          onPointerDown={aoPousar}
          className="shrink-0 touch-none select-none"
        >
          {/*
            * A pega não é decoração: é o que diz que isto se arrasta. Sem ela
            * ninguém descobre o gesto, e um gesto que ninguém descobre é
            * trabalho deitado fora.
            */}
          <div className="flex justify-center pb-1 pt-2.5">
            <span aria-hidden="true" className="h-1 w-9 rounded-full bg-border" />
          </div>
          {cabecalho}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  )
}
