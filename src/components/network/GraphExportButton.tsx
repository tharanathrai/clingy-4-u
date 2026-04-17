import { Download } from 'lucide-react'
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
      await new Promise((resolve) => {
        window.setTimeout(resolve, 100)
      })

      const sourceCanvas = graphRef.current
      const side = Math.max(sourceCanvas.width, sourceCanvas.height)
      const snapshot = document.createElement('canvas')
      snapshot.width = side
      snapshot.height = side
      const context = snapshot.getContext('2d')
      if (!context) {
        return
      }

      context.fillStyle = '#12101A'
      context.fillRect(0, 0, snapshot.width, snapshot.height)
      const offsetX = (side - sourceCanvas.width) / 2
      const offsetY = (side - sourceCanvas.height) / 2
      context.drawImage(sourceCanvas, offsetX, offsetY)

      const downloadLink = document.createElement('a')
      downloadLink.href = snapshot.toDataURL('image/png')
      downloadLink.download = `my-bridges-${getFileDate()}.png`
      downloadLink.click()

      setShowToast(true)
      window.setTimeout(() => {
        setShowToast(false)
      }, 1800)
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
        className="rounded-full border border-white/10 bg-surface px-3 py-2 text-text transition hover:border-white/25 hover:bg-surface-2 active:scale-95 disabled:opacity-50"
        aria-label="Export graph as image"
        disabled={saving}
      >
        <Download size={18} strokeWidth={1.75} />
      </button>
      {showToast ? (
        <div className="absolute right-0 top-12 rounded-full bg-surface-2 px-3 py-1 text-xs text-text">
          Saved to your photos
        </div>
      ) : null}
    </>
  )
}
