import { useEffect, useMemo, useState } from 'react'
import { CATEGORIES, type CategorySlug } from '../../lib/constants.ts'
import { supabase } from '../../lib/supabase.ts'
import type { Bridge } from '../../types/index.ts'

interface UnwrapCeremonyProps {
  bridge: Bridge
  draftPostId: string | null
  onComplete: (toast?: string) => void
}

export function UnwrapCeremony({
  bridge,
  draftPostId,
  onComplete,
}: UnwrapCeremonyProps) {
  const [phase, setPhase] = useState<'start' | 'gum' | 'line' | 'text' | 'done'>(
    'start',
  )
  const [showPrompt, setShowPrompt] = useState(false)
  const [postBody, setPostBody] = useState('')
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categorySlug = toCategorySlug(bridge.category)
  const accentClass = useMemo(() => toAccentClass(categorySlug), [categorySlug])
  const reducedMotion = useMemo(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  useEffect(() => {
    if (reducedMotion) {
      const reducedTimer = window.setTimeout(() => {
        setPhase('done')
        setShowPrompt(true)
      }, 500)
      return () => {
        window.clearTimeout(reducedTimer)
      }
    }

    const gumTimer = window.setTimeout(() => setPhase('gum'), 400)
    const lineTimer = window.setTimeout(() => setPhase('line'), 700)
    const textTimer = window.setTimeout(() => setPhase('text'), 1300)
    const doneTimer = window.setTimeout(() => {
      setPhase('done')
      setShowPrompt(true)
    }, 2100)

    return () => {
      window.clearTimeout(gumTimer)
      window.clearTimeout(lineTimer)
      window.clearTimeout(textTimer)
      window.clearTimeout(doneTimer)
    }
  }, [reducedMotion])

  useEffect(() => {
    if (!showPrompt || !draftPostId) {
      return
    }

    let cancelled = false
    const loadDraft = async () => {
      setLoadingDraft(true)
      const { data } = await supabase
        .from('posts')
        .select('body')
        .eq('id', draftPostId)
        .maybeSingle<{ body: string }>()

      if (!cancelled) {
        setPostBody(data?.body ?? bridge.activity_title)
        setLoadingDraft(false)
      }
    }

    void loadDraft()
    return () => {
      cancelled = true
    }
  }, [bridge.activity_title, draftPostId, showPrompt])

  useEffect(() => {
    if (!showPrompt || draftPostId) {
      return
    }
    setPostBody(bridge.activity_title)
  }, [bridge.activity_title, draftPostId, showPrompt])

  const handlePostIt = async () => {
    if (submitting || postBody.trim().length === 0 || postBody.length > 500) {
      return
    }
    setSubmitting(true)
    setError(null)

    const { error: createError } = await supabase.functions.invoke('create-post', {
      body: {
        bridge_id: bridge.id,
        body: postBody.trim(),
        is_public: true,
      },
    })

    if (createError) {
      setError('Could not post right now. Try again.')
      setSubmitting(false)
      return
    }

    onComplete('Posted to your network!')
  }

  const handleSkip = async () => {
    if (submitting) {
      return
    }
    setSubmitting(true)
    setError(null)

    if (draftPostId) {
      const { error: updateError } = await supabase
        .from('posts')
        .update({
          body: postBody.trim(),
          is_public: false,
        })
        .eq('id', draftPostId)

      if (updateError) {
        setError('Could not save draft right now. Try again.')
        setSubmitting(false)
        return
      }
    }

    onComplete()
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center bg-bg px-5 text-text">
      <div className="unwrap-scene">
        <div className="unwrap-wrapper" aria-hidden>
          <div
            className={`unwrap-half unwrap-half-top ${phase !== 'start' ? 'unwrap-half-top-open' : ''}`}
          />
          <div
            className={`unwrap-half unwrap-half-bottom ${phase !== 'start' ? 'unwrap-half-bottom-open' : ''}`}
          />
        </div>

        <div
          className={`unwrap-gum ${accentClass} ${phase === 'gum' || phase === 'line' || phase === 'text' || phase === 'done' ? 'unwrap-gum-in' : ''}`}
        />

        <div className="unwrap-line-track">
          <div
            className={`unwrap-line ${accentClass} ${phase === 'line' || phase === 'text' || phase === 'done' ? 'unwrap-line-grow' : ''}`}
          />
          <span
            className={`unwrap-line-end ${accentClass} ${phase === 'line' || phase === 'text' || phase === 'done' ? 'unwrap-line-end-pulse' : ''}`}
          />
        </div>

        <div className={`unwrap-radial ${accentClass} ${phase === 'text' ? 'unwrap-radial-pulse' : ''}`} />
      </div>

      <h1 className={`mt-8 text-center font-display text-3xl ${phase === 'text' || phase === 'done' ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}>
        {bridge.activity_title}
      </h1>
      <p className={`mt-2 text-center text-sm text-text-2 ${phase === 'text' || phase === 'done' ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}>
        Bridge formed.
      </p>

      <div className="app-fixed-frame bottom-24 z-40 px-5">
        <div
          className={`app-fixed-frame-inner rounded-xl border border-white/10 bg-surface p-4 shadow-card transition-all duration-300 ${
            showPrompt ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
          }`}
        >
          <h2 className="font-display text-xl text-text">Share this?</h2>
          <textarea
            value={postBody}
            onChange={(event) => setPostBody(event.target.value)}
            maxLength={500}
            className="post-optin-textarea mt-3 w-full rounded-md border border-white/10 bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-3 focus:outline-none"
            placeholder="Write your post..."
            disabled={loadingDraft}
          />
          <p className="mt-1 text-right text-xs text-text-3">{postBody.length} / 500</p>
          {error ? <p className="mt-2 text-sm text-playful">{error}</p> : null}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handlePostIt()}
              disabled={submitting || postBody.trim().length === 0 || postBody.length > 500}
              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {submitting ? 'Saving...' : 'Post it'}
            </button>
            <button
              type="button"
              onClick={() => void handleSkip()}
              disabled={submitting}
              className="rounded-full bg-surface-2 px-4 py-2 text-sm font-medium text-text-2 disabled:opacity-60"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function toCategorySlug(category: string): CategorySlug {
  if (category in CATEGORIES) {
    return category as CategorySlug
  }

  return 'explore'
}

function toAccentClass(category: CategorySlug): string {
  if (category === 'intimate') return 'bg-intimate'
  if (category === 'active') return 'bg-active'
  if (category === 'playful') return 'bg-playful'
  if (category === 'explore') return 'bg-explore'
  if (category === 'recharge') return 'bg-recharge'
  if (category === 'savor') return 'bg-savor'
  return 'bg-support'
}
