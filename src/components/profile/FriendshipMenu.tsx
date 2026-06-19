import { useEffect, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'
import { iconButtonClassName } from '../../lib/iconButton.ts'
import { useFriendshipActions } from '../../hooks/useFriendshipActions.ts'

const SNOOZE_REMINDER_KEY = 'clingy:snooze-reminder-dismissed'

interface FriendshipMenuProps {
  otherUserId: string
  otherUsername: string
  otherUserName: string
  isSnoozed: boolean
  onActionDone: () => void
  onRemoved: () => void
}

export function FriendshipMenu({
  otherUserId,
  otherUsername,
  otherUserName,
  isSnoozed,
  onActionDone,
  onRemoved,
}: FriendshipMenuProps) {
  const [open, setOpen] = useState(false)
  const [showSnoozeModal, setShowSnoozeModal] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [dontRemind, setDontRemind] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const { snooze, unsnooze, remove, loading } = useFriendshipActions()

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!showSnoozeModal) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowSnoozeModal(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showSnoozeModal])

  useEffect(() => {
    if (!showRemoveConfirm) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowRemoveConfirm(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showRemoveConfirm])

  const handleSnooze = async () => {
    setOpen(false)
    await snooze(otherUserId, otherUsername)
    onActionDone()
    const dismissed = localStorage.getItem(SNOOZE_REMINDER_KEY) === 'true'
    if (!dismissed) {
      setShowSnoozeModal(true)
    }
  }

  const handleUnsnooze = async () => {
    setOpen(false)
    await unsnooze(otherUserId, otherUsername)
    onActionDone()
  }

  const handleRemoveClick = () => {
    setOpen(false)
    setShowRemoveConfirm(true)
  }

  const handleConfirmRemove = async () => {
    setShowRemoveConfirm(false)
    await remove(otherUserId, otherUsername)
    onRemoved()
  }

  const handleDontRemindChange = (checked: boolean) => {
    setDontRemind(checked)
    if (checked) {
      localStorage.setItem(SNOOZE_REMINDER_KEY, 'true')
    } else {
      localStorage.removeItem(SNOOZE_REMINDER_KEY)
    }
  }

  return (
    <>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={iconButtonClassName}
          aria-label="Manage friendship"
          aria-expanded={open}
          aria-haspopup="menu"
          disabled={loading}
        >
          <MoreVertical size={18} strokeWidth={1.75} />
        </button>

        {open ? (
          <div
            role="menu"
            className="absolute right-0 top-12 z-30 min-w-44 overflow-hidden rounded-2xl border border-white/10 bg-surface py-1 shadow-lg"
          >
            {isSnoozed ? (
              <button
                type="button"
                role="menuitem"
                className="flex min-h-11 w-full items-center px-4 text-left text-sm text-text transition hover:bg-surface-2"
                onClick={handleUnsnooze}
              >
                Unsnooze
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                className="flex min-h-11 w-full items-center px-4 text-left text-sm text-text transition hover:bg-surface-2"
                onClick={handleSnooze}
              >
                Snooze
              </button>
            )}
            <div className="border-t border-white/10" />
            <button
              type="button"
              role="menuitem"
              className="flex min-h-11 w-full items-center px-4 text-left text-sm text-red-400 transition hover:bg-surface-2"
              onClick={handleRemoveClick}
            >
              Remove friend
            </button>
          </div>
        ) : null}
      </div>

      {/* Snooze info modal */}
      {showSnoozeModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setShowSnoozeModal(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="relative z-10 w-full max-w-xs rounded-2xl border border-white/10 bg-surface p-6">
            <p className="text-sm text-text-2">
              Snoozing {otherUserName} hides their posts from your Feed, unless
              you&apos;re both part of the activity. They won&apos;t know.
            </p>
            <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm text-text-2">
              <input
                type="checkbox"
                checked={dontRemind}
                onChange={(e) => handleDontRemindChange(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-surface-2 accent-accent"
              />
              Don&apos;t remind me again
            </label>
          </div>
        </div>
      ) : null}

      {/* Remove friend confirmation modal */}
      {showRemoveConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => setShowRemoveConfirm(false)}
            className="absolute inset-0 bg-black/60"
          />
          <div className="relative z-10 w-full max-w-xs rounded-2xl border border-white/10 bg-surface p-6">
            <p className="text-center text-base font-medium text-text">
              Do you no longer wish to be friends?
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowRemoveConfirm(false)}
                className="flex-1 rounded-full border border-white/10 py-3 text-sm text-text-2 transition hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={loading}
                className="flex-1 rounded-full bg-red-500/15 py-3 text-sm text-red-400 transition hover:bg-red-500/25 disabled:opacity-50"
              >
                End Friendship
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
