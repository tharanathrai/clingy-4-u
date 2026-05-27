import { LocateFixed } from 'lucide-react'

interface RecenterGraphButtonProps {
  onRecenter: () => void
  disabled?: boolean
}

export function RecenterGraphButton({ onRecenter, disabled = false }: RecenterGraphButtonProps) {
  return (
    <button
      type="button"
      onClick={() => {
        onRecenter()
      }}
      className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/10 bg-surface text-text transition hover:border-white/25 hover:bg-surface-2 active:scale-95 disabled:opacity-50"
      aria-label="Recenter network graph"
      title="Recenter graph"
      disabled={disabled}
    >
      <LocateFixed size={18} strokeWidth={1.75} />
    </button>
  )
}
