import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CategoryChip } from '../components/gum/CategoryChip.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { CATEGORIES, type CategorySlug } from '../lib/constants.ts'
import { supabase } from '../lib/supabase.ts'

interface ActiveConnection {
  id: string
  display_name: string
  avatar_url: string | null
}

interface CategorizeResponse {
  category: string
  color_hex: string
}

interface CreatePieceResponse {
  gum_piece: { id: string }
}
interface CreatePieceErrorResponse {
  error?: string
}

interface LocationState {
  recipientId?: string
}

const functionsBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function PieceNew() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const location = useLocation()
  const navigate = useNavigate()
  const [connections, setConnections] = useState<ActiveConnection[]>([])
  const [connectionsLoading, setConnectionsLoading] = useState(true)
  const [recipientId, setRecipientId] = useState('')
  const [title, setTitle] = useState('')
  const [categoryPreview, setCategoryPreview] = useState<CategorySlug | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const locationState = location.state as LocationState | null

  const loadConnections = useCallback(async () => {
    if (!userId) {
      setConnections([])
      setConnectionsLoading(false)
      return
    }

    setConnectionsLoading(true)
    const { data: connectionRows } = await supabase
      .from('connections')
      .select('id, user_a_id, user_b_id')
      .eq('status', 'active')
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)

    const otherIds = (connectionRows ?? []).map((row) =>
      row.user_a_id === userId ? row.user_b_id : row.user_a_id,
    )

    if (otherIds.length === 0) {
      setConnections([])
      setConnectionsLoading(false)
      return
    }

    const { data: userRows } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .in('id', otherIds)

    const nextConnections: ActiveConnection[] = (userRows ?? []).map((row) => ({
      id: row.id,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
    }))

    setConnections(nextConnections)
    setConnectionsLoading(false)
  }, [userId])

  useEffect(() => {
    void loadConnections()
  }, [loadConnections])

  useEffect(() => {
    if (locationState?.recipientId) {
      setRecipientId(locationState.recipientId)
    }
  }, [locationState?.recipientId])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null)
    }, 3000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [toast])

  useEffect(() => {
    if (!title.trim()) {
      setCategoryPreview(null)
      return
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData.session?.access_token
        if (!accessToken) {
          return
        }

        const response = await fetch(`${functionsBaseUrl}/categorize-gum`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: publishableKey,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ title: title.trim() }),
        })

        if (!response.ok) {
          return
        }

        const data = (await response.json()) as CategorizeResponse
        if (data.category in CATEGORIES) {
          setCategoryPreview(data.category as CategorySlug)
        }
      })()
    }, 300)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [title])

  const canSubmit = recipientId.trim().length > 0 && title.trim().length > 0 && !submitting

  const selectedRecipientName = useMemo(() => {
    return connections.find((connection) => connection.id === recipientId)?.display_name
  }, [connections, recipientId])

  const handleSubmit = async () => {
    if (!canSubmit) {
      return
    }

    try {
      setSubmitting(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        setToast('Something went wrong - try again.')
        setSubmitting(false)
        return
      }

      const response = await fetch(`${functionsBaseUrl}/create-gum-piece`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: publishableKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          recipient_id: recipientId,
          title: title.trim(),
        }),
      })

      let payload: CreatePieceResponse | CreatePieceErrorResponse = {}
      try {
        payload = (await response.json()) as CreatePieceResponse | CreatePieceErrorResponse
      } catch {
        payload = {}
      }

      if (!response.ok) {
        const errorCode = 'error' in payload ? payload.error : undefined
        if (errorCode === 'slot_limit_global') {
          setToast('Your pocket is full (25/25). Complete or clear a plan first.')
        } else if (errorCode === 'slot_limit_pair') {
          setToast('You have 5 plans with this person already.')
        } else if (errorCode === 'connection_required') {
          setToast('You can only make plans with active connections.')
        } else if (errorCode === 'title_required') {
          setToast('Add a title first.')
        } else {
          setToast(errorCode ?? 'Something went wrong - try again.')
        }

        setSubmitting(false)
        return
      }

      navigate('/home', {
        replace: true,
        state: { toast: `Plan sent to ${selectedRecipientName ?? 'them'}!` },
      })
    } catch {
      setToast('Something went wrong - try again.')
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-bg px-5 pb-8 pt-6 text-text">
      <div className="mb-6">
        <Link to="/home" className="inline-flex items-center gap-2 text-sm text-text-2">
          <ArrowLeft size={18} strokeWidth={1.75} />
          back
        </Link>
      </div>

      <h1 className="app-page-title">new gum</h1>

      {connectionsLoading ? (
        <p className="mt-6 text-sm text-text-2">Loading connections...</p>
      ) : (
        <section className="mt-6">
          <p className="text-xs uppercase text-text-3">Choose someone</p>
          {connections.length === 0 ? (
            <p className="mt-2 text-sm text-text-2">Add someone first before making a plan.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {connections.map((connection) => {
                const isSelected = recipientId === connection.id
                return (
                  <li key={connection.id}>
                    <button
                      type="button"
                      onClick={() => setRecipientId(connection.id)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left ${isSelected ? 'border-accent bg-surface-2' : 'border-white/10 bg-surface'}`}
                    >
                      {connection.avatar_url ? (
                        <img
                          src={connection.avatar_url}
                          alt={connection.display_name}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-sm text-text-2">
                          {connection.display_name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm text-text">{connection.display_name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      <section className="mt-6">
        <label htmlFor="piece-title" className="text-xs uppercase text-text-3">
          Plan title
        </label>
        <div className="mt-2 rounded-md border border-white/10 bg-surface-2 p-3">
          <input
            id="piece-title"
            value={title}
            onChange={(event) => setTitle(event.target.value.slice(0, 60))}
            maxLength={60}
            placeholder="what do you want to do together?"
            className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-3"
          />
          <p className="mt-2 text-right text-xs text-text-3">{title.length} / 60</p>
        </div>
        {categoryPreview ? (
          <div className="mt-3 flex items-center gap-2">
            <p className="text-sm text-text-2">looks like</p>
            <CategoryChip category={categoryPreview} size="md" />
          </div>
        ) : null}
      </section>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => void handleSubmit()}
        className="mt-8 w-full rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'wrapping...' : 'wrap it'}
      </button>

      {toast ? (
        <p className="fixed inset-x-5 bottom-24 rounded-md bg-surface-2 px-4 py-3 text-center text-sm text-text">
          {toast}
        </p>
      ) : null}
    </main>
  )
}
