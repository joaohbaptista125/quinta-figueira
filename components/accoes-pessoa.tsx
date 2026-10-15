'use client'

import { alternarActivoPessoa, apagarPessoa } from '@/lib/accoes/pessoas'
import { AccoesFicha } from '@/components/accoes-ficha'

/**
 * As duas saídas da ficha de uma pessoa, com a regra que só aqui se aplica:
 * ninguém se desactiva a si próprio, que seria trancar-se cá fora.
 */
export function AccoesPessoa({
  id,
  nome,
  activa,
  eEuPropria,
}: {
  id: string
  nome: string
  activa: boolean
  eEuPropria: boolean
}) {
  const primeiroNome = nome.split(' ')[0]

  return (
    <AccoesFicha
      id={id}
      alternar={
        eEuPropria
          ? undefined
          : {
              accao: alternarActivoPessoa,
              rotulo: activa ? 'Desactivar' : 'Reactivar',
              titulo: activa
                ? `${primeiroNome} sai das listas e dos formulários, e tudo o que já lá está fica`
                : `${primeiroNome} volta a aparecer nas listas`,
              icone: activa ? 'desactivar' : 'reactivar',
            }
      }
      apagar={{
        accao: apagarPessoa,
        confirmacao: `Apagar a ficha de ${nome} para sempre?\n\nSe tiver cavalos, contratos ou pagamentos, a aplicação recusa — nesse caso use «Desactivar».`,
      }}
    />
  )
}
