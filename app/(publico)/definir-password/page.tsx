import type { Metadata } from 'next'
import { FormularioDefinirPassword } from './formulario'

export const metadata: Metadata = { title: 'Definir palavra-passe' }

export default function PaginaDefinirPassword() {
  return <FormularioDefinirPassword />
}
