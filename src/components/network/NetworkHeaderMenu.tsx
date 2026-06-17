import { useEffect, useRef, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'

interface NetworkHeaderMenuProps {
  pendingRequestCount: number
}

export function NetworkHeaderMenu({ pendingRequestCount }: NetworkHeaderMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value)
        }}
        className="relative flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/10 bg-surface px-3 py-2 text-text transition hover:border-white/25 hover:bg-surface-2 active:scale-95"
        aria-label="Network actions"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <UserPlus size={18} strokeWidth={1.75} />
        {pendingRequestCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-accent px-1.5 py-0.5 text-[10px] leading-none text-white">
            {pendingRequestCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-30 min-w-40 overflow-hidden rounded-2xl border border-white/10 bg-surface py-1 shadow-lg"
        >
          <Link
            to="/add"
            role="menuitem"
            className="flex min-h-11 items-center px-4 text-sm text-text transition hover:bg-surface-2"
            onClick={() => {
              setOpen(false)
            }}
          >
            Add someone
          </Link>
          <Link
            to="/connections/requests"
            role="menuitem"
            className="flex min-h-11 items-center justify-between gap-3 px-4 text-sm text-text transition hover:bg-surface-2"
            onClick={() => {
              setOpen(false)
            }}
          >
            <span>Requests</span>
            {pendingRequestCount > 0 ? (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] leading-none text-white">
                {pendingRequestCount}
              </span>
            ) : null}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
