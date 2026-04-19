import { Download } from 'lucide-react'
import html2canvas from 'html2canvas'
import { useState, type RefObject } from 'react'

interface GraphExportButtonProps {
  graphRef: RefObject<HTMLCanvasElement | null>
}

const getFileDate = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function GraphExportButton({ graphRef }: GraphExportButtonProps) {
  const [saving, setSaving] = useState(false)
  const [showToast, setShowToast] = useState(false)

  const handleExport = async () => {
    if (!graphRef.current || saving) {
      return
    }

    setSaving(true)

    try {
      const snapshot = await html2canvas(graphRef.current, {
        backgroundColor: '#12101A',
        useCORS: true,
        scale: Math.max(window.devicePixelRatio, 2),
      })

      const downloadLink = document.createElement('a')
      downloadLink.href = snapshot.toDataURL('image/png')
      downloadLink.download = `my-bridges-${getFileDate()}.png`
      downloadLink.click()

      setShowToast(true)
      window.setTimeout(() => {
        setShowToast(false)
      }, 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void handleExport()
        }}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-surface text-text-2 transition hover:border-white/20 hover:bg-surface-2 hover:text-text active:scale-95 disabled:opacity-50"
        aria-label="Export graph as image"
        disabled={saving}
      >
        <Download size={18} strokeWidth={1.75} />
      </button>
      {showToast ? (
        <div className="absolute right-0 top-12 rounded-full bg-surface-2 px-3 py-1 text-xs text-text">
          Saved!
        </div>
      ) : null}
    </>
  )
}
