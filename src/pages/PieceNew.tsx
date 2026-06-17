import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { CategoryPicker } from '../components/gum/CategoryPicker.tsx'
import { BackHeader } from '../components/layout/BackHeader.tsx'
import { pageShellScroll, toastFrameClass } from '../components/layout/pageShell.ts'
import { useAuth } from '../hooks/useAuth.ts'
import { categorizeTitle } from '../lib/categorizeTitle.ts'
import type { CategorySlug } from '../lib/constants.ts'
import { supabase } from '../lib/supabase.ts'
import { queryKeys } from '../lib/queryKeys.ts'
import { withAvatarSize } from '../utils/avatar.ts'

interface ActiveConnection {
  id: string
  display_name: string
  avatar_url: string | null
}

interface CreatePieceResponse {
  gum_piece: { id: string }
}
interface CreatePieceErrorResponse {
  error?: string
}

interface LocationState {
  recipientId?: string
  returnTo?: string
  selectUserId?: string
}

const functionsBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function PieceNew() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [connections, setConnections] = useState<ActiveConnection[]>([])
  const [bridgeStrengthByConnectionId, setBridgeStrengthByConnectionId] = useState<
    Record<string, number>
  >({})
  const [pairSlotUsage, setPairSlotUsage] = useState<Record<string, number>>({})
  const [connectionsLoading, setConnectionsLoading] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  // Multi-select: set of selected recipient IDs
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [recipientQuery, setRecipientQuery] = useState('')
  const [showRecipientOptions, setShowRecipientOptions] = useState(false)
  const [title, setTitle] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<CategorySlug | null>(null)
  const [categoryManuallySelected, setCategoryManuallySelected] = useState(false)
  const [isSuggestingCategory, setIsSuggestingCategory] = useState(false)
  const [plannedDate, setPlannedDate] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const todayStr = new Date().toISOString().slice(0, 10)
  const maxDateStr = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const locationState = location.state as LocationState | null

  const loadConnections = useCallback(async () => {
    if (!userId) {
      setConnections([])
      setBridgeStrengthByConnectionId({})
      setPairSlotUsage({})
      setConnectionsLoading(false)
      return
    }

    setConnectionsLoading(true)
    setConnectionError(null)
    try {
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
        setBridgeStrengthByConnectionId({})
        setPairSlotUsage({})
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

      // Fetch pair slot usage via members table
      const [{ data: memberRows }, { data: bridgeRows }] = await Promise.all([
        supabase
          .from('gum_piece_members')
          .select('gum_piece_id')
          .eq('user_id', userId),
        supabase
          .from('bridges')
          .select('user_a_id, user_b_id')
          .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`),
      ])

      const myPieceIds = (memberRows ?? []).map((r) => r.gum_piece_id as string)

      const nextPairUsage: Record<string, number> = {}
      if (myPieceIds.length > 0) {
        const { data: activePieceRows } = await supabase
          .from('gum_pieces')
          .select('id')
          .in('id', myPieceIds)
          .in('status', ['placeholder', 'active'])

        const activePieceIds = (activePieceRows ?? []).map((r) => r.id)

        if (activePieceIds.length > 0) {
          const { data: otherMemberRows } = await supabase
            .from('gum_piece_members')
            .select('user_id, gum_piece_id')
            .in('gum_piece_id', activePieceIds)
            .neq('user_id', userId)

          for (const row of otherMemberRows ?? []) {
            const otherId = row.user_id
            if (!otherIds.includes(otherId)) continue
            nextPairUsage[otherId] = (nextPairUsage[otherId] ?? 0) + 1
          }
        }
      }

      const nextStrength: Record<string, number> = {}
      for (const row of bridgeRows ?? []) {
        const otherId = row.user_a_id === userId ? row.user_b_id : row.user_a_id
        if (!otherIds.includes(otherId)) continue
        nextStrength[otherId] = (nextStrength[otherId] ?? 0) + 1
      }

      setBridgeStrengthByConnectionId(nextStrength)
      setPairSlotUsage(nextPairUsage)
    } catch {
      setConnectionError('Could not load your connections.')
    } finally {
      setConnectionsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void loadConnections()
  }, [loadConnections])

  useEffect(() => {
    if (locationState?.recipientId) {
      setSelectedIds(new Set([locationState.recipientId]))
    }
  }, [locationState?.recipientId])

  useEffect(() => {
    if (!toast) return
    const timeoutId = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  useEffect(() => {
    const trimmed = title.trim()
    if (!trimmed) {
      if (!categoryManuallySelected) {
        setSelectedCategory(null)
      }
      setIsSuggestingCategory(false)
      return
    }

    setIsSuggestingCategory(true)
    const timeoutId = window.setTimeout(() => {
      if (!categoryManuallySelected) {
        setSelectedCategory(categorizeTitle(trimmed))
      }
      setIsSuggestingCategory(false)
    }, 500)

    return () => window.clearTimeout(timeoutId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title])

  const backTarget = locationState?.returnTo ?? '/home'

  const createPieceMutation = useMutation({
    mutationFn: async ({
      recipientIds,
      title: t,
      category,
      plannedDate: pd,
    }: {
      recipientIds: string[]
      title: string
      category: CategorySlug | null
      plannedDate: string
    }) => {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Session expired — try again.')

      const response = await fetch(`${functionsBaseUrl}/create-gum-piece`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: publishableKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          recipient_ids: recipientIds,
          title: t,
          ...(category ? { category } : {}),
          ...(pd ? { planned_date: pd } : {}),
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
        if (errorCode === 'slot_limit_global') throw new Error('Your pocket is full (25/25). Complete or clear a plan first.')
        if (errorCode === 'slot_limit_global_recipient') throw new Error('One of your invitees has a full pocket.')
        if (errorCode === 'slot_limit_pair') throw new Error('You have 5 plans with one of these people already.')
        if (errorCode === 'connection_required') throw new Error('You can only make plans with active connections.')
        if (errorCode === 'title_required') throw new Error('Add a title first.')
        if (errorCode === 'too_many_recipients') throw new Error('You can invite up to 9 people.')
        throw new Error(errorCode ?? 'Something went wrong - try again.')
      }

      return { count: recipientIds.length }
    },
    onSuccess: ({ count }) => {
      setCategoryManuallySelected(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.gumPieces(userId) })
      const label = count === 1 ? 'them' : `${count} people`
      navigate('/home', {
        replace: true,
        state: { toast: `Plan sent to ${label}!` },
      })
    },
    onError: (err) => {
      setToast(err instanceof Error ? err.message : 'Something went wrong - try again.')
    },
  })

  const canSubmit = selectedIds.size > 0 && title.trim().length > 0 && !createPieceMutation.isPending

  const sortedConnections = useMemo(() => {
    return [...connections].sort((a, b) => {
      const aAtLimit = (pairSlotUsage[a.id] ?? 0) >= 5
      const bAtLimit = (pairSlotUsage[b.id] ?? 0) >= 5
      const strengthDelta =
        (bridgeStrengthByConnectionId[b.id] ?? 0) - (bridgeStrengthByConnectionId[a.id] ?? 0)

      if (aAtLimit !== bAtLimit) return aAtLimit ? 1 : -1
      if (strengthDelta !== 0) return strengthDelta
      return a.display_name.localeCompare(b.display_name)
    })
  }, [bridgeStrengthByConnectionId, connections, pairSlotUsage])

  const filteredConnections = useMemo(() => {
    const query = recipientQuery.trim().toLowerCase()
    if (!query) return sortedConnections
    return sortedConnections.filter((connection) =>
      connection.display_name.toLowerCase().includes(query),
    )
  }, [recipientQuery, sortedConnections])

  const resolvedCategory = selectedCategory ?? (title.trim() ? categorizeTitle(title.trim()) : null)

  const handleSubmit = () => {
    if (!canSubmit) return
    createPieceMutation.mutate({
      recipientIds: Array.from(selectedIds),
      title: title.trim(),
      category: resolvedCategory,
      plannedDate,
    })
  }

  const toggleRecipient = (connectionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(connectionId)) {
        next.delete(connectionId)
      } else {
        next.add(connectionId)
      }
      return next
    })
  }

  const selectedConnections = useMemo(
    () => connections.filter((c) => selectedIds.has(c.id)),
    [connections, selectedIds],
  )

  const backTo =
    locationState?.selectUserId != null
      ? ({
          pathname: backTarget,
          state: { selectUserId: locationState.selectUserId },
        } as const)
      : backTarget

  return (
    <main className={`${pageShellScroll} safe-content-bottom pt-6`}>
      <BackHeader to={backTo} className="mb-4" />

      <h1 className="app-page-title">new gum</h1>

      {connectionsLoading ? (
        <section className="mt-6 space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="skeleton h-12 rounded-lg" />
          ))}
        </section>
      ) : (
        <section className="mt-6">
          <p className="text-xs text-text-3">Choose people</p>
          {connectionError ? (
            <>
              <p className="mt-2 text-sm text-playful">{connectionError}</p>
              <button
                type="button"
                onClick={() => void loadConnections()}
                className="mt-3 rounded-full bg-surface-2 px-5 py-2 text-sm text-text-2"
              >
                Retry
              </button>
            </>
          ) : connections.length === 0 ? (
            <>
              <p className="mt-2 text-sm text-text-2">Add someone first before making a plan.</p>
              <Link
                to="/add"
                className="btn-primary mt-4 inline-block rounded-full bg-accent px-6 py-3 text-sm font-medium text-white"
              >
                Add someone
              </Link>
            </>
          ) : (
            <>
              {/* Selected recipients as chips */}
              {selectedConnections.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedConnections.map((connection) => (
                    <span
                      key={connection.id}
                      className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-sm text-text"
                    >
                      {connection.avatar_url ? (
                        <img
                          src={withAvatarSize(connection.avatar_url, 32) ?? connection.avatar_url}
                          alt={connection.display_name}
                          className="h-5 w-5 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-bg text-xs text-text-2">
                          {connection.display_name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      {connection.display_name}
                      <button
                        type="button"
                        onClick={() => toggleRecipient(connection.id)}
                        className="ml-0.5 text-text-3 hover:text-text"
                        aria-label={`Remove ${connection.display_name}`}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="relative mt-3">
                <input
                  value={recipientQuery}
                  onFocus={() => setShowRecipientOptions(true)}
                  onBlur={() => {
                    window.setTimeout(() => {
                      setShowRecipientOptions(false)
                    }, 120)
                  }}
                  onChange={(event) => {
                    setRecipientQuery(event.target.value)
                    setShowRecipientOptions(true)
                  }}
                  placeholder={selectedIds.size === 0 ? 'Type a name...' : 'Add more people...'}
                  className="w-full rounded-md border border-white/10 bg-surface-2 px-4 py-3 text-sm text-text outline-none placeholder:text-text-3 focus:border-white/20"
                />
                {showRecipientOptions ? (
                  <ul className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-white/10 bg-surface p-2 shadow-card">
                    {filteredConnections.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-text-3">No matches</li>
                    ) : (
                      filteredConnections.map((connection) => {
                        const pairSlotsUsed = pairSlotUsage[connection.id] ?? 0
                        const pairAtLimit = pairSlotsUsed >= 5
                        const bridgeStrength = bridgeStrengthByConnectionId[connection.id] ?? 0
                        const isSelected = selectedIds.has(connection.id)
                        return (
                          <li key={connection.id}>
                            <button
                              type="button"
                              disabled={pairAtLimit && !isSelected}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                toggleRecipient(connection.id)
                                setRecipientQuery('')
                              }}
                              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left ${
                                pairAtLimit && !isSelected
                                  ? 'cursor-not-allowed opacity-60'
                                  : isSelected
                                    ? 'bg-surface-2'
                                    : 'hover:bg-surface-2'
                              }`}
                            >
                              {connection.avatar_url ? (
                                <img
                                  src={withAvatarSize(connection.avatar_url, 48) ?? connection.avatar_url}
                                  alt={connection.display_name}
                                  className="h-8 w-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-xs text-text-2">
                                  {connection.display_name.slice(0, 1).toUpperCase()}
                                </div>
                              )}
                              <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm text-text">{connection.display_name}</span>
                                <span className="text-xs text-text-3">
                                  {bridgeStrength} shared {bridgeStrength === 1 ? 'bridge' : 'bridges'}
                                  {pairAtLimit ? ' · 5/5 plans in progress' : ''}
                                </span>
                              </div>
                              {isSelected ? (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] text-white">
                                  ✓
                                </span>
                              ) : null}
                            </button>
                          </li>
                        )
                      })
                    )}
                  </ul>
                ) : null}
              </div>
            </>
          )}
        </section>
      )}

      <section className="mt-6">
        <label htmlFor="piece-title" className="text-xs text-text-3">
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
        {(title.trim() || selectedCategory !== null) ? (
          <div
            className={`mt-4 transition-opacity ${isSuggestingCategory ? 'opacity-70' : 'opacity-100'}`}
          >
            <CategoryPicker
              selectedCategory={selectedCategory}
              onSelect={(cat) => {
                setCategoryManuallySelected(true)
                setSelectedCategory(cat)
              }}
            />
          </div>
        ) : null}
      </section>

      <section className="mt-6">
        <div className="flex items-baseline gap-2">
          <label htmlFor="planned-date" className="text-xs text-text-3">
            by when?
          </label>
          <span className="text-xs text-text-3 opacity-60">optional · defaults to 1 year from today</span>
        </div>
        <input
          id="planned-date"
          type="date"
          value={plannedDate}
          min={todayStr}
          max={maxDateStr}
          onChange={(event) => setPlannedDate(event.target.value)}
          className="mt-2 w-full rounded-md border border-white/10 bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-white/20 [color-scheme:dark]"
        />
      </section>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => void handleSubmit()}
        className="btn-primary mt-8 w-full rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {createPieceMutation.isPending ? 'wrapping...' : 'wrap it'}
      </button>

      {toast ? (
        <div className={toastFrameClass}>
          <p className="app-fixed-frame-inner rounded-md bg-surface-2 px-4 py-3 text-center text-sm text-text">
            {toast}
          </p>
        </div>
      ) : null}
    </main>
  )
}
