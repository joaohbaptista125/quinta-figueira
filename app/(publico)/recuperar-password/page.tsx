import type { Metadata } from 'next'
import { FormularioRecuperar } from './formulario'

export const metadata: Metadata = { title: 'Recuperar palavra-passe' }

export default function PaginaRecuperar() {
  return <FormularioRecuperar />
}
