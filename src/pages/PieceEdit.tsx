import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CategoryPicker } from '../components/gum/CategoryPicker.tsx'
import { BackHeader } from '../components/layout/BackHeader.tsx'
import { pageShellScroll } from '../components/layout/pageShell.ts'
import { useAuth } from '../hooks/useAuth.ts'
import { categorizeTitle } from '../lib/categorizeTitle.ts'
import type { CategorySlug } from '../lib/constants.ts'
import { supabase } from '../lib/supabase.ts'
import { queryKeys } from '../lib/queryKeys.ts'
import { invalidateGumPieceFlow } from '../lib/invalidate.ts'
import { isInitialQueryLoading } from '../lib/queryLoading.ts'
import type { GumPiece } from '../types/index.ts'

const functionsBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY

async function fetchPieceForEdit(id: string, userId: string): Promise<GumPiece | null> {
  const [pieceResult, memberResult] = await Promise.all([
    supabase.from('gum_pieces').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('gum_piece_members')
      .select('user_id, status')
      .eq('gum_piece_id', id)
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (pieceResult.error) throw new Error(pieceResult.error.message)
  if (!pieceResult.data || !memberResult.data) return null

  return pieceResult.data as GumPiece
}

export default function PieceEdit() {
  const { id } = useParams()
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const queryKey = queryKeys.pieceDetail(id, userId)

  const { data: piece, isPending, error } = useQuery({
    queryKey: ['piece-edit', id, userId],
    queryFn: () => fetchPieceForEdit(id!, userId!),
    enabled: !authLoading && Boolean(id) && userId !== null,
    staleTime: 30 * 1000,
  })

  const loading = isInitialQueryLoading(authLoading, userId, isPending)

  const [title, setTitle] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<CategorySlug | null>(null)
  const [isSuggestingCategory, setIsSuggestingCategory] = useState(false)
  const [plannedDate, setPlannedDate] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!piece) return
    setTitle(piece.title)
    setSelectedCategory((piece.category as CategorySlug) ?? null)
    setPlannedDate(piece.planned_date ?? '')
  }, [piece])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const trimmed = title.trim()
    if (!trimmed || !piece) return

    setIsSuggestingCategory(true)
    const t = window.setTimeout(() => {
      if (trimmed !== piece.title) {
        setSelectedCategory(categorizeTitle(trimmed))
      }
      setIsSuggestingCategory(false)
    }, 500)
    return () => window.clearTimeout(t)
  }, [title, piece])

  const proposeMutation = useMutation({
    mutationFn: async () => {
      if (!piece) throw new Error('No piece')
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) throw new Error('Session expired — try again.')

      const currentTitle = title.trim()
      const body: Record<string, unknown> = {
        gum_piece_id: piece.id,
        action: 'propose',
      }

      if (currentTitle !== piece.title) body.title = currentTitle
      if (selectedCategory && selectedCategory !== piece.category) body.category = selectedCategory
      const currentDate = plannedDate || null
      if (currentDate !== piece.planned_date) body.planned_date = currentDate

      const response = await fetch(`${functionsBaseUrl}/edit-gum-piece`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: publishableKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      })

      let payload: { error?: string } = {}
      try {
        payload = (await response.json()) as { error?: string }
      } catch {
        payload = {}
      }

      if (!response.ok) {
        const code = payload.error
        if (code === 'no_changes') throw new Error("Nothing changed — update at least one field.")
        if (code === 'edit_already_pending') throw new Error("Someone already proposed a change. Accept or decline it first.")
        if (code === 'title_invalid') throw new Error('Title must be 1–60 characters.')
        if (code === 'category_invalid') throw new Error('Invalid category.')
        if (code === 'planned_date_invalid') throw new Error('Date must be within the next year.')
        throw new Error(code ?? 'Something went wrong — try again.')
      }
    },
    onSuccess: () => {
      if (userId && id) {
        invalidateGumPieceFlow(userId, queryClient, id)
      }
      void queryClient.invalidateQueries({ queryKey: ['piece-edit', id, userId] })
      void queryClient.invalidateQueries({ queryKey })
      navigate(-1)
    },
    onError: (err) => {
      setToast(err instanceof Error ? err.message : 'Something went wrong — try again.')
    },
  })

  const todayStr = new Date().toISOString().slice(0, 10)
  const maxDateStr = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  if (!id) return <Navigate to="/home" replace />

  if (loading) {
    return (
      <main className={pageShellScroll}>
        <div className="skeleton mb-2 h-11 w-16 rounded" />
        <div className="skeleton mt-6 h-24 w-full rounded-lg" />
        <div className="skeleton mt-4 h-12 w-full rounded-lg" />
      </main>
    )
  }

  if (error || !piece) return <Navigate to="/home" replace />

  // Only editable when placeholder or active
  if (piece.status !== 'placeholder' && piece.status !== 'active') {
    return <Navigate to={`/piece/${id}`} replace />
  }

  // Block if there's already a pending edit (guard — UI should prevent this too)
  if (piece.status === 'active' && piece.pending_edit) {
    return <Navigate to={`/piece/${id}`} replace />
  }

  const currentTitle = title.trim()
  const resolvedCategory = selectedCategory
  const titleChanged = currentTitle !== piece.title
  const categoryChanged = resolvedCategory !== null && resolvedCategory !== piece.category
  const dateChanged = (plannedDate || null) !== piece.planned_date
  const hasChanges = titleChanged || categoryChanged || dateChanged
  const canSubmit = currentTitle.length > 0 && hasChanges && !proposeMutation.isPending
  const isActiveProposal = piece.status === 'active'

  return (
    <main className={`${pageShellScroll} safe-content-bottom pt-6`}>
      <BackHeader to={`/piece/${id}`} className="mb-4" />

      <h1 className="app-page-title">edit plan</h1>

      {isActiveProposal ? (
        <p className="mt-2 text-sm text-text-2">
          Others will need to accept your changes before they apply.
        </p>
      ) : (
        <p className="mt-2 text-sm text-text-2">Changes apply immediately.</p>
      )}

      <section className="mt-6">
        <label htmlFor="piece-title" className="text-xs text-text-3">
          Plan title
        </label>
        <div className="mt-2 rounded-md border border-white/10 bg-surface-2 p-3">
          <input
            id="piece-title"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 60))}
            maxLength={60}
            placeholder="what do you want to do together?"
            className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-3"
          />
          <p className="mt-2 text-right text-xs text-text-3">{title.length} / 60</p>
        </div>

        {title.trim() ? (
          <div className={`mt-4 transition-opacity ${isSuggestingCategory ? 'opacity-70' : 'opacity-100'}`}>
            <CategoryPicker
              selectedCategory={resolvedCategory}
              onSelect={setSelectedCategory}
            />
          </div>
        ) : null}
      </section>

      <section className="mt-6">
        <div className="flex items-baseline gap-2">
          <label htmlFor="planned-date" className="text-xs text-text-3">
            by when?
          </label>
          <span className="text-xs text-text-3 opacity-60">optional</span>
        </div>
        <input
          id="planned-date"
          type="date"
          value={plannedDate}
          min={todayStr}
          max={maxDateStr}
          onChange={(e) => setPlannedDate(e.target.value)}
          className="mt-2 w-full rounded-md border border-white/10 bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-white/20 [color-scheme:dark]"
        />
        {plannedDate ? (
          <button
            type="button"
            onClick={() => setPlannedDate('')}
            className="mt-1 text-xs text-text-3 underline underline-offset-2"
          >
            Clear date
          </button>
        ) : null}
      </section>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => proposeMutation.mutate()}
        className="btn-primary mt-8 w-full rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {proposeMutation.isPending
          ? isActiveProposal
            ? 'Proposing...'
            : 'Saving...'
          : isActiveProposal
            ? 'Propose change'
            : 'Save changes'}
      </button>

      {toast ? (
        <div className="app-fixed-frame safe-bottom-24 px-5">
          <p className="app-fixed-frame-inner rounded-md bg-surface-2 px-4 py-3 text-center text-sm text-text">
            {toast}
          </p>
        </div>
      ) : null}
    </main>
  )
}
