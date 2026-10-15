'use client'

import { useActionState, useEffect, useState } from 'react'
import { Bell, BellOff, Share } from 'lucide-react'
import {
  guardarSubscricao,
  removerSubscricao,
} from '@/lib/accoes/notificacoes'
import { SEM_RESULTADO } from '@/lib/accoes/resultado'
import { Botao } from '@/components/ui/botao'
import { Aviso } from '@/components/ui/superficie'

/**
 * Converte a chave VAPID de base64url para bytes, que é o que o browser quer.
 */
function chaveParaBytes(base64url: string) {
  const preenchimento = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + preenchimento).replace(/-/g, '+').replace(/_/g, '/')
  const bruto = window.atob(base64)
  return Uint8Array.from([...bruto].map((caracter) => caracter.charCodeAt(0)))
}

/** Um nome para a pessoa se reconhecer na lista de telemóveis avisados. */
function nomeDoAparelho() {
  const agente = navigator.userAgent
  if (/iPhone/.test(agente)) return 'iPhone'
  if (/iPad/.test(agente)) return 'iPad'
  if (/Android/.test(agente)) return 'Android'
  if (/Macintosh/.test(agente)) return 'Mac'
  if (/Windows/.test(agente)) return 'Windows'
  return 'Este aparelho'
}

type Estado =
  | 'a-verificar'
  | 'sem-suporte'
  | 'precisa-instalar'
  | 'negada'
  | 'desligada'
  | 'ligada'

/**
 * Ligar e desligar as notificações neste aparelho.
 *
 * Três coisas que este botão tem de saber, e que são a diferença entre
 * funcionar e deixar a pessoa a olhar:
 *
 * 1. **No iPhone não existe permissão fora do ecrã principal.** O Safari só
 *    dá notificações a uma aplicação instalada, e num separador normal nem o
 *    pedido aparece. Por isso detectamos isso e explicamos o caminho em vez
 *    de mostrar um botão que não faz nada.
 * 2. **A autorização tem de nascer de um toque.** Pedi-la ao carregar a
 *    página é recusada pelo browser, e pior: a pessoa fica a achar que
 *    recusou.
 * 3. **Recusada é recusada.** Depois de negada, nenhum código a volta a
 *    pedir — só a própria pessoa, nas definições do telemóvel. Dizemos isso
 *    em vez de insistir.
 *
 * Tudo isto corre num `useEffect` porque no servidor não há `navigator` nem
 * `Notification`.
 */
export function ActivarNotificacoes({ chavePublica }: { chavePublica: string }) {
  const [estado, setEstado] = useState<Estado>('a-verificar')
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aTrabalhar, setATrabalhar] = useState(false)

  const [resultadoGuardar, guardar] = useActionState(
    guardarSubscricao,
    SEM_RESULTADO,
  )
  const [resultadoRemover, remover] = useActionState(
    removerSubscricao,
    SEM_RESULTADO,
  )

  useEffect(() => {
    if (!chavePublica) {
      setEstado('sem-suporte')
      return
    }

    const temApi =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    if (!temApi) {
      // No iPhone a API só existe dentro da aplicação instalada. Se estamos
      // num Safari de iOS sem ela, o caminho é instalar — não é «não dá».
      const eApple = /iPhone|iPad|iPod/.test(navigator.userAgent)
      setEstado(eApple ? 'precisa-instalar' : 'sem-suporte')
      return
    }

    if (Notification.permission === 'denied') {
      setEstado('negada')
      return
    }

    navigator.serviceWorker.ready
      .then((registo) => registo.pushManager.getSubscription())
      .then((subscricao) => {
        setEndpoint(subscricao?.endpoint ?? null)
        setEstado(subscricao ? 'ligada' : 'desligada')
      })
      .catch(() => setEstado('desligada'))
  }, [chavePublica])

  async function ligar() {
    setErro(null)
    setATrabalhar(true)
    try {
      const permissao = await Notification.requestPermission()
      if (permissao !== 'granted') {
        setEstado(permissao === 'denied' ? 'negada' : 'desligada')
        return
      }

      const registo = await navigator.serviceWorker.ready
      const subscricao = await registo.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chaveParaBytes(chavePublica),
      })

      const bruta = subscricao.toJSON()
      const dados = new FormData()
      dados.set('endpoint', subscricao.endpoint)
      dados.set('p256dh', bruta.keys?.p256dh ?? '')
      dados.set('auth', bruta.keys?.auth ?? '')
      dados.set('agente', nomeDoAparelho())

      guardar(dados)
      setEndpoint(subscricao.endpoint)
      setEstado('ligada')
    } catch {
      setErro('Não foi possível ligar as notificações neste aparelho.')
    } finally {
      setATrabalhar(false)
    }
  }

  async function desligar() {
    setErro(null)
    setATrabalhar(true)
    try {
      const registo = await navigator.serviceWorker.ready
      const subscricao = await registo.pushManager.getSubscription()
      const morada = subscricao?.endpoint ?? endpoint

      await subscricao?.unsubscribe()

      if (morada) {
        const dados = new FormData()
        dados.set('endpoint', morada)
        remover(dados)
      }

      setEndpoint(null)
      setEstado('desligada')
    } catch {
      setErro('Não foi possível desligar as notificações neste aparelho.')
    } finally {
      setATrabalhar(false)
    }
  }

  if (estado === 'a-verificar') {
    return <p className="text-sm text-muted-foreground">Um instante…</p>
  }

  if (estado === 'precisa-instalar') {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-muted-foreground">
          No iPhone e no iPad, as notificações só funcionam com a aplicação
          instalada no ecrã principal. São três toques:
        </p>
        <ol className="ml-4 list-decimal space-y-1 text-muted-foreground">
          <li>
            Toque em{' '}
            <Share className="inline size-4 align-text-bottom" aria-hidden />{' '}
            <span className="text-foreground">Partilhar</span>, na barra do
            Safari.
          </li>
          <li>
            Escolha{' '}
            <span className="text-foreground">Adicionar ao ecrã principal</span>.
          </li>
          <li>
            Abra a Quinta da Figueira pelo ícone novo e volte aqui para ligar as
            notificações.
          </li>
        </ol>
      </div>
    )
  }

  if (estado === 'sem-suporte') {
    return (
      <p className="text-sm text-muted-foreground">
        Este aparelho não aceita notificações. Continua a ver tudo ao abrir a
        aplicação.
      </p>
    )
  }

  if (estado === 'negada') {
    return (
      <div className="space-y-1 text-sm">
        <p className="text-muted-foreground">
          As notificações estão bloqueadas para este sítio. A aplicação já não
          as pode pedir outra vez — tem de as desbloquear nas definições do
          aparelho e voltar aqui.
        </p>
      </div>
    )
  }

  const mensagem = resultadoGuardar.mensagem ?? resultadoRemover.mensagem

  return (
    <div className="space-y-2">
      {estado === 'ligada' ? (
        <Botao variante="contorno" onClick={desligar} disabled={aTrabalhar}>
          <BellOff className="size-4" aria-hidden />
          {aTrabalhar ? 'Um instante…' : 'Desligar neste aparelho'}
        </Botao>
      ) : (
        <Botao onClick={ligar} disabled={aTrabalhar}>
          <Bell className="size-4" aria-hidden />
          {aTrabalhar ? 'Um instante…' : 'Avisar-me neste aparelho'}
        </Botao>
      )}

      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {!erro && mensagem ? <Aviso tom="sucesso">{mensagem}</Aviso> : null}

      <p className="text-xs text-muted-foreground">
        A autorização é deste aparelho. Se usar o telemóvel e o computador, tem
        de ligar nos dois.
      </p>
    </div>
  )
}
