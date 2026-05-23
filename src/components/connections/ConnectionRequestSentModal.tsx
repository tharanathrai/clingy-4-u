import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { ValidateQrUser } from '../../lib/validateQrToken.ts'
import { withAvatarSize } from '../../utils/avatar.ts'

interface ConnectionRequestSentModalProps {
  open: boolean
  user: ValidateQrUser | null
  onClose: () => void
}

export function ConnectionRequestSentModal({
  open,
  user,
  onClose,
}: ConnectionRequestSentModalProps) {
  const historyPushedRef = useRef(false)

  const dismiss = useCallback(
    (fromPopState = false) => {
      if (!fromPopState && historyPushedRef.current) {
        historyPushedRef.current = false
        window.history.back()
        return
      }

      historyPushedRef.current = false
      onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) {
      return
    }

    document.body.classList.add('modal-scroll-lock')
    window.history.pushState({ connectionRequestSentModal: true }, '')
    historyPushedRef.current = true

    const onPopState = () => {
      dismiss(true)
    }

    window.addEventListener('popstate', onPopState)

    return () => {
      document.body.classList.remove('modal-scroll-lock')
      window.removeEventListener('popstate', onPopState)
    }
  }, [dismiss, open])

  const initials = useMemo(() => {
    if (!user) {
      return '?'
    }
    return user.display_name.slice(0, 1).toUpperCase()
  }, [user])

  if (!open || !user) {
    return null
  }

  const avatarUrl = withAvatarSize(user.avatar_url, 80)

  return (
    <section className="app-fixed-viewport z-50 flex items-center justify-center px-6">
      <button
        type="button"
        aria-label="Close"
        onClick={() => dismiss()}
        className="absolute inset-0 bg-black/60"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-request-sent-title"
        className="relative z-10 w-full max-w-xs rounded-xl border border-white/10 bg-surface p-6 text-center shadow-lg"
      >
        <button
          type="button"
          onClick={() => dismiss()}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-text-2 transition hover:bg-surface-2 hover:text-text active:scale-95"
          aria-label="Close"
        >
          <X size={18} strokeWidth={1.75} />
        </button>

        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={user.display_name}
            className="mx-auto h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-xl font-medium">
            {initials}
          </div>
        )}

        <p className="mt-3 text-base text-text">{user.display_name}</p>
        <p className="text-sm text-text-2">@{user.username}</p>

        <h2 id="connection-request-sent-title" className="mt-4 font-display text-xl text-text">
          Request sent
        </h2>
        <p className="mt-2 text-sm text-text-2">
          They&apos;ll get a notification to accept.
        </p>
      </div>
    </section>
  )
}
