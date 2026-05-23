import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth.ts'
import { invalidateConnectionFlow } from '../lib/invalidate.ts'
import { usePaginatedItems } from '../hooks/usePaginatedItems.ts'
import { supabase } from '../lib/supabase.ts'
import { withAvatarSize } from '../utils/avatar.ts'

interface PendingConnectionRequest {
  id: string
  requested_by: string
  display_name: string
  username: string
  avatar_url: string | null
}

export default function ConnectionRequests() {
  const { user, loading } = useAuth()
  const userId = user?.id ?? null
  const queryClient = useQueryClient()
  const [requests, setRequests] = useState<PendingConnectionRequest[]>([])
  const [fetching, setFetching] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null)

  const loadRequests = useCallback(async () => {
    if (!userId) {
      setFetching(false)
      return
    }

    setFetching(true)
    setErrorMessage(null)

    const { data: connectionRows, error: connectionError } = await supabase
      .from('connections')
      .select('id, requested_by, user_a_id, user_b_id')
      .eq('status', 'pending')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)

    if (connectionError || !connectionRows) {
      setErrorMessage('Something went wrong - try again.')
      setFetching(false)
      return
    }

    const incomingRows = connectionRows.filter((row) => row.requested_by !== userId)
    const requesterIds = incomingRows.map((row) => row.requested_by)

    if (requesterIds.length === 0) {
      setRequests([])
      setFetching(false)
      return
    }

    const { data: requesterRows, error: requesterError } = await supabase
      .from('users')
      .select('id, display_name, username, avatar_url')
      .in('id', requesterIds)

    if (requesterError || !requesterRows) {
      setErrorMessage('Something went wrong - try again.')
      setFetching(false)
      return
    }

    const requesterMap = new Map(requesterRows.map((item) => [item.id, item]))
    const mappedRequests: PendingConnectionRequest[] = incomingRows
      .map((row) => {
        const requester = requesterMap.get(row.requested_by)
        if (!requester) {
          return null
        }
        return {
          id: row.id,
          requested_by: row.requested_by,
          display_name: requester.display_name,
          username: requester.username,
          avatar_url: requester.avatar_url,
        }
      })
      .filter((item): item is PendingConnectionRequest => item !== null)

    setRequests(mappedRequests)
    setFetching(false)
  }, [userId])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  const {
    visibleItems: paginatedRequests,
    hasMore,
    loadMore,
  } = usePaginatedItems(requests, 6)

  const handleRespond = async (request: PendingConnectionRequest, action: 'accept' | 'reject') => {
    setBusyRequestId(request.id)
    setErrorMessage(null)

    const { data, error } = await supabase.functions.invoke<{
      success: boolean
      action: 'accept' | 'reject'
      connection_id: string
    }>('respond-connection', {
      body: {
        connection_id: request.id,
        action,
      },
    })

    if (error || !data?.success) {
      setErrorMessage('Something went wrong - try again.')
      setBusyRequestId(null)
      return
    }

    setRequests((current) => current.filter((item) => item.id !== request.id))
    if (action === 'accept') {
      invalidateConnectionFlow(userId, queryClient)
    }
    setBusyRequestId(null)
  }

  if (loading || fetching) {
    return (
      <main className="safe-screen-height safe-content-bottom safe-content-top mx-auto flex w-full max-w-md flex-col overflow-y-auto bg-bg px-5 py-8 text-text">
        <div className="skeleton mb-6 h-8 w-48 rounded" />
        <ul className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <li key={index} className="skeleton h-24 rounded-lg" />
          ))}
        </ul>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="safe-screen-height flex items-center justify-center bg-bg px-5 text-text">
        <p className="text-sm text-text-2">Sign in to view requests.</p>
      </main>
    )
  }

  return (
    <main className="safe-screen-height safe-content-bottom safe-content-top mx-auto flex w-full max-w-md flex-col overflow-y-auto bg-bg px-5 py-8 text-text">
      <h1 className="app-page-title">Connection requests</h1>

      {errorMessage && !fetching && requests.length === 0 ? (
        <div className="mt-8 rounded-lg bg-surface p-6 text-center">
          <p className="text-sm text-playful">{errorMessage}</p>
          <button
            type="button"
            className="mt-4 rounded-full bg-surface-2 px-5 py-2 text-sm text-text-2"
            onClick={() => void loadRequests()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {errorMessage && requests.length > 0 ? <p className="mt-4 text-sm text-playful">{errorMessage}</p> : null}

      {!errorMessage && requests.length === 0 ? (
        <div className="mt-8 rounded-lg bg-surface p-6 text-center">
          <p className="text-sm text-text-2">No pending requests.</p>
        </div>
      ) : requests.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {paginatedRequests.map((request) => (
            <li
              key={request.id}
              className="rounded-lg border border-white/10 bg-surface p-4"
            >
              <div className="flex items-center gap-3">
                {request.avatar_url ? (
                  <img
                    src={withAvatarSize(request.avatar_url, 48) ?? request.avatar_url}
                    alt={request.display_name}
                    className="h-11 w-11 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-sm">
                    {request.display_name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-text">{request.display_name}</p>
                  <p className="text-xs text-text-2">@{request.username}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void handleRespond(request, 'accept')}
                  disabled={busyRequestId === request.id}
                >
                  {busyRequestId === request.id ? 'Accepting...' : 'Accept'}
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-full bg-surface-2 px-4 py-2 text-sm font-medium text-text-2"
                  onClick={() => void handleRespond(request, 'reject')}
                  disabled={busyRequestId === request.id}
                >
                  {busyRequestId === request.id ? 'Declining...' : 'Decline'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!fetching && !errorMessage && hasMore ? (
        <button
          type="button"
          onClick={loadMore}
          className="mt-4 rounded-full bg-surface-2 px-5 py-2 text-sm text-text-2"
        >
          Load more
        </button>
      ) : null}

      <Link
        to="/network"
        className="mt-auto rounded-full bg-surface-2 px-7 py-3.5 text-center text-sm font-medium text-text-2"
      >
        Back to network
      </Link>
    </main>
  )
}
