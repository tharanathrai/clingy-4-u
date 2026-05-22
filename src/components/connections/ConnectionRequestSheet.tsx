import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.ts'
import { withAvatarSize } from '../../utils/avatar.ts'

interface ConnectionRequestSheetProps {
  connectionId: string | null
  onClose: () => void
  onResolved: (result: {
    action: 'accept' | 'reject' | 'invalid'
    connectionId: string
    otherUserId?: string
  }) => void
}

interface PendingConnection {
  id: string
  user_a_id: string
  user_b_id: string
  requested_by: string
  status: 'pending' | 'active'
}

interface RequesterProfile {
  id: string
  display_name: string
  username: string
  avatar_url: string | null
}

export function ConnectionRequestSheet({
  connectionId,
  onClose,
  onResolved,
}: ConnectionRequestSheetProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [request, setRequest] = useState<PendingConnection | null>(null)
  const [requester, setRequester] = useState<RequesterProfile | null>(null)
  const [busyAction, setBusyAction] = useState<'accept' | 'reject' | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  useEffect(() => {
    if (!connectionId) {
      return
    }

    document.body.classList.add('modal-scroll-lock')
    return () => {
      document.body.classList.remove('modal-scroll-lock')
    }
  }, [connectionId])

  useEffect(() => {
    if (!connectionId) {
      setLoading(false)
      setError(null)
      setRequest(null)
      setRequester(null)
      return
    }

    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)

      const { data: connectionRow, error: connectionError } = await supabase
        .from('connections')
        .select('id, user_a_id, user_b_id, requested_by, status')
        .eq('id', connectionId)
        .maybeSingle<PendingConnection>()

      if (cancelled) {
        return
      }

      if (connectionError) {
        setError('Something went wrong - try again.')
        setLoading(false)
        return
      }

      if (!connectionRow || connectionRow.status !== 'pending') {
        setRequest(null)
        setRequester(null)
        setLoading(false)
        return
      }

      const { data: requesterRow, error: requesterError } = await supabase
        .from('users')
        .select('id, display_name, username, avatar_url')
        .eq('id', connectionRow.requested_by)
        .maybeSingle<RequesterProfile>()

      if (cancelled) {
        return
      }

      if (requesterError || !requesterRow) {
        setError('Something went wrong - try again.')
        setLoading(false)
        return
      }

      setRequest(connectionRow)
      setRequester(requesterRow)
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [connectionId, reloadNonce])

  const initials = useMemo(() => {
    return requester?.display_name.slice(0, 1).toUpperCase() ?? '?'
  }, [requester])

  const handleRespond = async (action: 'accept' | 'reject') => {
    if (!connectionId) {
      return
    }

    setBusyAction(action)
    setError(null)

    const { data, error: invokeError } = await supabase.functions.invoke<{
      success: boolean
      action: 'accept' | 'reject'
      connection_id: string
      other_user_id?: string
    }>('respond-connection', {
      body: {
        connection_id: connectionId,
        action,
      },
    })

    setBusyAction(null)

    if (invokeError || !data?.success) {
      setError('Something went wrong - try again.')
      return
    }

    onResolved({
      action: data.action,
      connectionId: data.connection_id,
      otherUserId: data.other_user_id,
    })
  }

  if (!connectionId) {
    return null
  }

  return (
    <section className="app-fixed-viewport z-50">
      <button
        type="button"
        aria-label="Close connection request"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      <div className="sheet-slide-up absolute inset-x-0 bottom-0 rounded-t-xl border-t border-white/10 bg-surface px-5 pb-tab-clearance pt-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-3 flex h-11 w-11 items-center justify-center rounded-full text-text-2 transition hover:bg-surface-2 hover:text-text active:scale-95"
          aria-label="Close connection request"
        >
          <X size={18} strokeWidth={1.75} />
        </button>

        <h2 className="font-display text-2xl text-text">Connection request</h2>

        {loading ? <p className="mt-4 text-sm text-text-2">Loading request...</p> : null}

        {!loading && error ? (
          <div className="mt-4 rounded-lg bg-surface-2 p-4">
            <p className="text-sm text-playful">{error}</p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className="rounded-full bg-surface px-4 py-2 text-xs text-text-2"
                onClick={() => setReloadNonce((value) => value + 1)}
              >
                Retry
              </button>
              <button
                type="button"
                className="rounded-full bg-surface px-4 py-2 text-xs text-text-2"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}

        {!loading && !error && (!request || !requester) ? (
          <div className="mt-4 rounded-lg bg-surface-2 p-4">
            <p className="text-sm text-text-2">This request is no longer available.</p>
            <button
              type="button"
              className="mt-3 rounded-full bg-surface px-4 py-2 text-xs text-text-2"
              onClick={() =>
                onResolved({
                  action: 'invalid',
                  connectionId,
                })}
            >
              Close
            </button>
          </div>
        ) : null}

        {!loading && !error && request && requester ? (
          <div className="mt-4 rounded-lg bg-surface-2 p-4">
            <div className="flex items-center gap-3">
              {requester.avatar_url ? (
                <img
                  src={withAvatarSize(requester.avatar_url, 64) ?? requester.avatar_url}
                  alt={requester.display_name}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-base">
                  {initials}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-text">{requester.display_name}</p>
                <p className="text-xs text-text-2">@{requester.username}</p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={busyAction !== null}
                onClick={() => void handleRespond('accept')}
              >
                {busyAction === 'accept' ? 'Accepting...' : 'Accept'}
              </button>
              <button
                type="button"
                className="flex-1 rounded-full bg-surface px-4 py-2 text-sm font-medium text-text-2 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={busyAction !== null}
                onClick={() => void handleRespond('reject')}
              >
                {busyAction === 'reject' ? 'Declining...' : 'Decline'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
