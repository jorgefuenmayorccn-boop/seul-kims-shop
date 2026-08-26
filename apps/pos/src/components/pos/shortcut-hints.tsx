// Chip discreto en el footer del carrito mostrando shortcuts activos
interface ShortcutHintsProps {
  hasItems: boolean
}

const HINT_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  color: 'var(--color-text-muted)',
  opacity: 0.55,
}

export function ShortcutHints({ hasItems }: ShortcutHintsProps) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 py-2">
      <span style={HINT_STYLE}>F1 buscar</span>
      {hasItems && <span style={HINT_STYLE}>Enter cobrar</span>}
      {hasItems && <span style={HINT_STYLE}>F2 vaciar</span>}
      <span style={HINT_STYLE}>F5 reimprimir</span>
      <span style={HINT_STYLE}>Esc cancelar</span>
    </div>
  )
}
