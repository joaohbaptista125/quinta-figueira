'use client'

import { useEffect, useRef, useState } from 'react'
import { ContactRound } from 'lucide-react'
import { Botao } from '@/components/ui/botao'
import { Aviso } from '@/components/ui/superficie'
import { lerVCards, type ContactoLido } from '@/lib/vcard'

/*
 * Preencher a ficha a partir dos contactos do telemóvel.
 *
 * Há dois caminhos, porque só um funciona em cada lado:
 *
 *   Android — `navigator.contacts.select()` abre o selector do sistema. A
 *     aplicação recebe só os contactos escolhidos, nunca a lista toda, e não
 *     há permissão permanente a pedir: é como o `<input type="file">`, mas
 *     para contactos.
 *
 *   iPhone e computador — a Apple nunca implementou essa API, e no iOS todos
 *     os browsers são Safari por dentro, por isso não há volta. O caminho é o
 *     cartão de contacto: «Partilhar contacto → Guardar em Ficheiros» produz
 *     um `.vcf`, que se escolhe aqui. `lib/vcard.ts` é que o lê.
 *
 * O botão do selector só aparece onde funciona — mostrar um botão que não faz
 * nada é pior do que não o ter.
 *
 * Nada é escrito por cima: só se preenchem os campos que estão vazios. Quem
 * já escreveu o nome à mão não o quer ver trocado por outro.
 */

type MoradaDoSistema = {
  addressLine?: string[]
  city?: string
  country?: string
  postalCode?: string
  region?: string
}

type ContactoDoSistema = {
  name?: string[]
  tel?: string[]
  email?: string[]
  address?: MoradaDoSistema[]
}

type GestorDeContactos = {
  getProperties: () => Promise<string[]>
  select: (
    propriedades: string[],
    opcoes?: { multiple?: boolean },
  ) => Promise<ContactoDoSistema[]>
}

function gestorDeContactos(): GestorDeContactos | null {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return null
  }
  if (!('contacts' in navigator) || !('ContactsManager' in window)) return null
  return (navigator as Navigator & { contacts?: GestorDeContactos }).contacts ?? null
}

/** Os campos da ficha que sabemos preencher, por ordem de apresentação. */
const CAMPOS = [
  { chave: 'nome', campo: 'nome', rotulo: 'nome' },
  { chave: 'telefone', campo: 'telefone', rotulo: 'telefone' },
  { chave: 'email', campo: 'email', rotulo: 'email' },
  { chave: 'morada', campo: 'morada', rotulo: 'morada' },
] as const

type Estado =
  | { fase: 'nada' }
  | { fase: 'a-ler' }
  | { fase: 'escolher'; contactos: ContactoLido[] }
  | { fase: 'aplicado'; preenchidos: string[]; ignorados: string[] }
  | { fase: 'erro'; motivo: string }

export function ImportarContacto() {
  const ancora = useRef<HTMLDivElement>(null)
  const ficheiro = useRef<HTMLInputElement>(null)
  const [estado, setEstado] = useState<Estado>({ fase: 'nada' })
  const [temSelector, setTemSelector] = useState(false)

  // A detecção só pode acontecer depois de montar: no servidor não há
  // `navigator`, e desenhar o botão logo daria uma hidratação diferente.
  useEffect(() => {
    setTemSelector(gestorDeContactos() !== null)
  }, [])

  function preencher(contacto: ContactoLido) {
    const formulario = ancora.current?.closest('form')
    if (!formulario) return

    const preenchidos: string[] = []
    const ignorados: string[] = []

    for (const { chave, campo, rotulo } of CAMPOS) {
      const valor = contacto[chave]
      if (!valor) continue

      const elemento = formulario.elements.namedItem(campo)
      if (!(elemento instanceof HTMLInputElement)) continue

      if (elemento.value.trim() !== '') {
        ignorados.push(rotulo)
        continue
      }

      elemento.value = valor
      preenchidos.push(rotulo)
    }

    setEstado({ fase: 'aplicado', preenchidos, ignorados })
  }

  async function escolherDosContactos() {
    const gestor = gestorDeContactos()
    if (!gestor) return

    try {
      const disponiveis = await gestor.getProperties()
      const pedidas = ['name', 'tel', 'email', 'address'].filter((p) =>
        disponiveis.includes(p),
      )
      const escolhidos = await gestor.select(pedidas, { multiple: false })
      if (escolhidos.length === 0) return // Fechou o selector sem escolher.

      preencher(doSistema(escolhidos[0]))
    } catch {
      setEstado({
        fase: 'erro',
        motivo:
          'Não foi possível abrir os contactos. Preencha à mão, ou use um cartão de contacto.',
      })
    }
  }

  async function lerCartao(escolhido: File) {
    setEstado({ fase: 'a-ler' })
    try {
      const contactos = lerVCards(await escolhido.text())

      if (contactos.length === 0) {
        setEstado({
          fase: 'erro',
          motivo:
            'Não encontrei nenhum contacto neste ficheiro. Tem de ser um cartão de contacto (.vcf).',
        })
        return
      }

      if (contactos.length === 1) {
        preencher(contactos[0])
        return
      }

      setEstado({ fase: 'escolher', contactos })
    } catch {
      setEstado({ fase: 'erro', motivo: 'Não foi possível ler o ficheiro.' })
    }
  }

  return (
    <div
      ref={ancora}
      className="rounded-md border border-dashed border-border p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <ContactRound
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span className="text-sm font-medium">Já tem o contacto no telemóvel?</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {temSelector ? (
          <Botao
            variante="contorno"
            tamanho="pequeno"
            onClick={escolherDosContactos}
          >
            Escolher dos contactos
          </Botao>
        ) : null}

        <Botao
          variante="contorno"
          tamanho="pequeno"
          onClick={() => ficheiro.current?.click()}
        >
          Abrir cartão de contacto
        </Botao>

        <input
          ref={ficheiro}
          type="file"
          accept=".vcf,text/vcard,text/x-vcard"
          className="sr-only"
          onChange={(evento) => {
            const escolhido = evento.target.files?.[0]
            // Limpa o valor para se poder escolher o mesmo ficheiro outra vez.
            evento.target.value = ''
            if (escolhido) void lerCartao(escolhido)
          }}
        />
      </div>

      {!temSelector ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No iPhone: Contactos → a pessoa → <strong>Partilhar contacto</strong> →
          Guardar em Ficheiros. Depois escolha aqui esse ficheiro.
        </p>
      ) : null}

      {estado.fase === 'a-ler' ? (
        <p className="mt-2 text-xs text-muted-foreground">A ler o cartão…</p>
      ) : null}

      {estado.fase === 'erro' ? (
        <p className="mt-2 text-xs text-muted-foreground">{estado.motivo}</p>
      ) : null}

      {estado.fase === 'escolher' ? (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">
            O ficheiro tem {estado.contactos.length} contactos. Escolha um:
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {estado.contactos.map((contacto, indice) => (
              <li key={`${contacto.nome ?? ''}-${indice}`}>
                <Botao
                  variante="contorno"
                  tamanho="pequeno"
                  onClick={() => preencher(contacto)}
                >
                  {contacto.nome ?? contacto.telefone ?? 'Sem nome'}
                </Botao>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {estado.fase === 'aplicado' ? (
        <Aviso
          tom={estado.preenchidos.length > 0 ? 'sucesso' : 'atencao'}
          className="mt-2"
        >
          {estado.preenchidos.length > 0
            ? `Preenchido: ${estado.preenchidos.join(', ')}. Confirme antes de guardar.`
            : 'Não havia nada para preencher — os campos já estavam escritos.'}
          {estado.ignorados.length > 0 && estado.preenchidos.length > 0
            ? ` Não mexi em: ${estado.ignorados.join(', ')}.`
            : ''}
        </Aviso>
      ) : null}
    </div>
  )
}

/** Passa o que o selector do sistema devolve para a forma que o resto usa. */
function doSistema(contacto: ContactoDoSistema): ContactoLido {
  const morada = contacto.address?.[0]
  const arruamento = (morada?.addressLine ?? []).filter(Boolean).join(', ')
  const terra = [morada?.postalCode, morada?.city].filter(Boolean).join(' ')

  return {
    nome: primeiro(contacto.name),
    telefone: primeiro(contacto.tel),
    email: primeiro(contacto.email),
    morada:
      [arruamento, terra, morada?.region, morada?.country]
        .filter(Boolean)
        .join(', ') || null,
  }
}

function primeiro(valores: string[] | undefined): string | null {
  const valor = valores?.find((candidato) => candidato.trim() !== '')
  return valor ? valor.trim() : null
}
