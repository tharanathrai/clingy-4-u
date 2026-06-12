import { Share2 } from 'lucide-react'
import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  buildSocialShareSnapshot,
  canShareGraphFiles,
  getGraphSnapshotFileName,
} from '../../lib/graphSnapshot.ts'
import type { SocialShareCardOptions } from '../../lib/socialShareCard.ts'

interface GraphShareButtonProps {
  graphRef: RefObject<HTMLCanvasElement | null>
  disabled?: boolean
  prepareForSnapshot?: () => Promise<() => void>
  shareCardOptions: SocialShareCardOptions
}

type ToastMessage = 'shared' | 'saved' | 'error' | null

export function GraphShareButton({
  graphRef,
  disabled = false,
  prepareForSnapshot,
  shareCardOptions,
}: GraphShareButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<ToastMessage>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const canShare = canShareGraphFiles()

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const showToast = (message: ToastMessage) => {
    setToast(message)
    window.setTimeout(() => {
      setToast(null)
    }, 1800)
  }

  const buildSnapshot = async () => {
    if (!graphRef.current) {
      return null
    }

    const restoreSnapshot = prepareForSnapshot ? await prepareForSnapshot() : undefined

    try {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 100)
      })

      return buildSocialShareSnapshot(graphRef.current, shareCardOptions)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Graph snapshot capture failed', error)
      }
      return null
    } finally {
      restoreSnapshot?.()
    }
  }

  const handleSave = async () => {
    if (busy) {
      return
    }

    setBusy(true)
    setMenuOpen(false)

    try {
      const snapshot = await buildSnapshot()
      if (!snapshot) {
        showToast('error')
        return
      }

      const downloadLink = document.createElement('a')
      downloadLink.href = snapshot.dataUrl
      downloadLink.download = getGraphSnapshotFileName()
      downloadLink.click()
      showToast('saved')
    } finally {
      setBusy(false)
    }
  }

  const handleShare = async () => {
    if (busy || !canShare) {
      return
    }

    setBusy(true)
    setMenuOpen(false)

    try {
      const snapshot = await buildSnapshot()
      if (!snapshot) {
        showToast('error')
        return
      }

      const file = new File([snapshot.blob], getGraphSnapshotFileName(), {
        type: 'image/png',
      })

      await navigator.share({
        files: [file],
        title: 'My bridges',
      })
      showToast('shared')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      await handleSave()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setMenuOpen((value) => !value)
        }}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/10 bg-surface text-text transition hover:border-white/25 hover:bg-surface-2 active:scale-95 disabled:opacity-50"
        aria-label="Share network graph"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        disabled={busy || disabled}
      >
        <Share2 size={18} strokeWidth={1.75} />
      </button>

      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-30 min-w-36 overflow-hidden rounded-2xl border border-white/10 bg-surface py-1 shadow-lg"
        >
          {canShare ? (
            <button
              type="button"
              role="menuitem"
              className="flex min-h-11 w-full items-center px-4 text-left text-sm text-text transition hover:bg-surface-2 disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                void handleShare()
              }}
            >
              Share…
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="flex min-h-11 w-full items-center px-4 text-left text-sm text-text transition hover:bg-surface-2 disabled:opacity-50"
            disabled={busy}
            onClick={() => {
              void handleSave()
            }}
          >
            Save image
          </button>
        </div>
      ) : null}

      {toast ? (
        <div className="absolute right-0 top-12 whitespace-nowrap rounded-full bg-surface-2 px-3 py-1 text-xs text-text">
          {toast === 'shared'
            ? 'Shared'
            : toast === 'saved'
              ? 'Saved to your photos'
              : "Couldn't save image — try again"}
        </div>
      ) : null}
    </div>
  )
}
