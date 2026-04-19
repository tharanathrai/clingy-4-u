import { LocateFixed } from 'lucide-react'

interface RecenterGraphButtonProps {
  onRecenter: () => void
  disabled?: boolean
}

export function RecenterGraphButton({ onRecenter, disabled = false }: RecenterGraphButtonProps) {
  return (
    <button
      type="button"
      onClick={onRecenter}
      className="rounded-full border border-white/10 bg-surface px-3 py-2 text-text transition hover:border-white/25 hover:bg-surface-2 active:scale-95 disabled:opacity-50"
      aria-label="Recenter network graph"
      title="Recenter graph"
      disabled={disabled}
    >
      <LocateFixed size={18} strokeWidth={1.75} />
    </button>
  )
}
