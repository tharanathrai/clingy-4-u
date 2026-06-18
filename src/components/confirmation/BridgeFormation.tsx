import { useEffect, useState } from 'react'
import { pageShellCentered } from '../layout/pageShell.ts'
import { supabase } from '../../lib/supabase.ts'
import type { Bridge } from '../../types/index.ts'

interface BridgeFormationProps {
  bridge: Bridge
  activityTitle: string
  draftPostId: string | null
  suggestedPostBody: string | null
  onComplete: (toast?: string) => void
}

export function BridgeFormation({
  bridge,
  activityTitle,
  draftPostId,
  suggestedPostBody,
  onComplete,
}: BridgeFormationProps) {
  const [showSharePanel, setShowSharePanel] = useState(false)
  const [postBody, setPostBody] = useState(suggestedPostBody ?? activityTitle)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPostBody(suggestedPostBody ?? activityTitle)
  }, [activityTitle, suggestedPostBody])

  const handlePostIt = async () => {
    if (submitting || postBody.trim().length === 0 || postBody.length > 500) return
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

  return (
    <main className={`${pageShellCentered} px-5`}>
      <div className="flex w-full flex-col items-center gap-4 text-center">
        <h1 className="font-display text-3xl text-text">{activityTitle}</h1>
        <p className="text-sm text-text-2">Bridge formed.</p>

        {!showSharePanel ? (
          <div className="mt-4 flex w-full flex-col gap-3">
            <button
              type="button"
              onClick={() => setShowSharePanel(true)}
              className="btn-primary w-full rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white"
            >
              Share to Feed
            </button>
            <button
              type="button"
              onClick={() => onComplete()}
              className="w-full rounded-full bg-surface-2 px-7 py-3.5 text-sm font-medium text-text-2"
            >
              Keep it private
            </button>
          </div>
        ) : (
          <div className="mt-4 w-full rounded-xl border border-white/10 bg-surface p-4 shadow-card text-left">
            <h2 className="font-display text-xl text-text">Share this?</h2>
            <textarea
              value={postBody}
              onChange={(e) => setPostBody(e.target.value)}
              maxLength={500}
              className="post-optin-textarea mt-3 w-full rounded-md border border-white/10 bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-3 focus:outline-none"
              placeholder="Write your post..."
            />
            <p className="mt-1 text-right text-xs text-text-3">{postBody.length} / 500</p>
            {error ? <p className="mt-2 text-sm text-playful">{error}</p> : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handlePostIt()}
                disabled={submitting || postBody.trim().length === 0 || postBody.length > 500}
                className="btn-primary rounded-full bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {submitting ? 'Saving...' : 'Post'}
              </button>
              <button
                type="button"
                onClick={() => onComplete()}
                disabled={submitting}
                className="rounded-full bg-surface-2 px-4 py-2 text-sm font-medium text-text-2 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
