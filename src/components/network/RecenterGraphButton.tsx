import { Crosshair } from 'lucide-react'

interface RecenterGraphButtonProps {
  onRecenter: () => void
  disabled?: boolean
}

export function RecenterGraphButton({ onRecenter, disabled = false }: RecenterGraphButtonProps) {
  return (
    <button
      type="button"
      onClick={onRecenter}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-surface text-text-2 transition hover:border-white/20 hover:bg-surface-2 hover:text-text active:scale-95 disabled:opacity-50"
      aria-label="Recenter network graph"
      title="Recenter graph"
      disabled={disabled}
    >
      <Crosshair size={18} strokeWidth={1.75} />
    </button>
  )
}
