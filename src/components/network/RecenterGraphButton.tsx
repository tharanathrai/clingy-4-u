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
        // #region agent log
        fetch('http://127.0.0.1:7320/ingest/b9f84f1c-8004-4e98-93fb-d658dbf6a649',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ae4bc5'},body:JSON.stringify({sessionId:'ae4bc5',runId:'interaction-lock-3',hypothesisId:'H12',location:'RecenterGraphButton.tsx:onClick',message:'Recenter button click handler executed',data:{disabled},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        onRecenter()
      }}
      className="rounded-full border border-white/10 bg-surface px-3 py-2 text-text transition hover:border-white/25 hover:bg-surface-2 active:scale-95 disabled:opacity-50"
      aria-label="Recenter network graph"
      title="Recenter graph"
      disabled={disabled}
    >
      <LocateFixed size={18} strokeWidth={1.75} />
    </button>
  )
}
