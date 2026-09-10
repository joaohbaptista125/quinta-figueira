/**
 * Ferradura, no traço das restantes ícones (lucide): 24×24, sem preenchimento,
 * `currentColor`, traço 2. A lucide não tem nada equestre, e «Cavalos» é a
 * secção mais usada da aplicação — merecia um símbolo que se reconhecesse de
 * relance na barra do telemóvel.
 *
 * Vai com as pontas para cima, como se pendura à porta da cavalariça: das
 * orientações que experimentei foi a única que se lê como ferradura e não
 * como um arco qualquer quando fica com vinte pixels de lado.
 */
export function Ferradura({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M6 4v8a6 6 0 0 0 12 0V4" />
      <path d="M4 4h4" />
      <path d="M16 4h4" />
    </svg>
  )
}
