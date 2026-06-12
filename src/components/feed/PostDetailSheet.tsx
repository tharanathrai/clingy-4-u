import { Send, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.ts'
import { type CommentWithUser, usePost } from '../../hooks/usePost.ts'
import {
  canNavigateToProfile,
  navigateToProfile,
} from '../../lib/navigationContext.ts'
import { supabase } from '../../lib/supabase.ts'
import { CommentItem } from './CommentItem.tsx'
import { FeedPostCard } from './FeedPostCard.tsx'

interface PostDetailSheetProps {
  postId: string | null
  autoFocusComposer?: boolean
  onClose: () => void
  onPostMetricsChange?: (next: {
    postId: string
    reactionCount: number
    commentCount: number
    hasReacted: boolean
  }) => void
}

export function PostDetailSheet({
  postId,
  autoFocusComposer = false,
  onClose,
  onPostMetricsChange,
}: PostDetailSheetProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [commentBody, setCommentBody] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const { post, reactionCount: serverReactionCount, hasReacted: serverHasReacted, comments, loading, error } =
    usePost({
      postId: postId ?? '',
    })
  const [optimisticReactionCount, setOptimisticReactionCount] = useState<number | null>(
    null,
  )
  const [optimisticHasReacted, setOptimisticHasReacted] = useState<boolean | null>(null)
  const [optimisticCommentCount, setOptimisticCommentCount] = useState<number | null>(null)
  const [optimisticComments, setOptimisticComments] = useState<CommentWithUser[]>([])
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const commentInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setOptimisticReactionCount(null)
    setOptimisticHasReacted(null)
    setOptimisticCommentCount(null)
    setOptimisticComments([])
    setCommentBody('')
  }, [postId])


  useEffect(() => {
    if (!postId) {
      setKeyboardOffset(0)
      return
    }

    const viewport = window.visualViewport
    if (!viewport) {
      return
    }

    const updateKeyboardOffset = () => {
      const offset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      setKeyboardOffset(offset)
    }

    viewport.addEventListener('resize', updateKeyboardOffset)
    viewport.addEventListener('scroll', updateKeyboardOffset)
    updateKeyboardOffset()

    return () => {
      viewport.removeEventListener('resize', updateKeyboardOffset)
      viewport.removeEventListener('scroll', updateKeyboardOffset)
      setKeyboardOffset(0)
    }
  }, [postId])

  useEffect(() => {
    if (!postId || !autoFocusComposer) {
      return
    }

    commentInputRef.current?.focus()
  }, [autoFocusComposer, postId])

  useEffect(() => {
    if (!postId) {
      return
    }

    document.body.classList.add('modal-scroll-lock')
    return () => {
      document.body.classList.remove('modal-scroll-lock')
    }
  }, [postId])

  const hasReacted = optimisticHasReacted ?? serverHasReacted
  const reactionCount = optimisticReactionCount ?? serverReactionCount
  const commentCount = optimisticCommentCount ?? comments.length
  const displayedComments = useMemo(() => {
    const serverCommentIds = new Set(comments.map((comment) => comment.id))
    return [
      ...comments,
      ...optimisticComments.filter((comment) => !serverCommentIds.has(comment.id)),
    ]
  }, [comments, optimisticComments])

  if (!postId) {
    return null
  }

  const navigateToFeedProfile = (username: string) => {
    navigateToProfile(navigate, {
      username,
      returnTo: '/feed',
      restorePostId: postId,
    })
  }

  const handleToggleReaction = async () => {
    if (!postId) {
      return
    }

    const nextHasReacted = !hasReacted
    const nextReactionCount = Math.max(
      0,
      reactionCount + (nextHasReacted ? 1 : -1),
    )
    setOptimisticHasReacted(nextHasReacted)
    setOptimisticReactionCount(nextReactionCount)
    onPostMetricsChange?.({
      postId,
      reactionCount: nextReactionCount,
      commentCount,
      hasReacted: nextHasReacted,
    })

    await supabase.functions.invoke('toggle-reaction', {
      body: { post_id: postId },
    })
  }

  const handleSubmitComment = async () => {
    if (!user || !postId || submittingComment) {
      return
    }
    const trimmedComment = commentBody.trim()
    if (!trimmedComment) {
      return
    }
    setSubmittingComment(true)
    const nextCommentCount = commentCount + 1
    setOptimisticCommentCount(nextCommentCount)
    const tempCommentId = `temp-${crypto.randomUUID()}`
    const nowIso = new Date().toISOString()
    const authorProfile = post?.author
    const optimisticUser =
      authorProfile && authorProfile.id === user.id
        ? {
            id: authorProfile.id,
            display_name: authorProfile.display_name,
            username: authorProfile.username,
            avatar_url: authorProfile.avatar_url,
            bio: authorProfile.bio,
            created_at: authorProfile.created_at,
          }
        : {
            id: user.id,
            display_name: 'You',
            username: 'me',
            avatar_url: null,
            bio: null,
            created_at: nowIso,
          }

    setOptimisticComments((current) => [
      ...current,
      {
        id: tempCommentId,
        post_id: postId,
        user_id: user.id,
        body: trimmedComment,
        created_at: nowIso,
        user: optimisticUser,
      },
    ])

    onPostMetricsChange?.({
      postId,
      reactionCount,
      commentCount: nextCommentCount,
      hasReacted,
    })

    const { data: insertedComment, error: insertError } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        user_id: user.id,
        body: trimmedComment,
      })
      .select('*')
      .single()

    if (insertError || !insertedComment) {
      setOptimisticComments((current) =>
        current.filter((comment) => comment.id !== tempCommentId),
      )
      setSubmittingComment(false)
      return
    }

    setOptimisticComments((current) =>
      current.map((comment) =>
        comment.id === tempCommentId
          ? {
              ...comment,
              id: insertedComment.id,
              created_at: insertedComment.created_at,
            }
          : comment,
      ),
    )

    setCommentBody('')
    setSubmittingComment(false)
  }

  return (
    <section className="app-fixed-viewport post-detail-viewport z-50">
      <button
        type="button"
        aria-label="Close post details"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      <div
        className="sheet-slide-up absolute inset-x-0 top-0 flex flex-col overflow-hidden rounded-t-xl border-t border-white/10 bg-surface"
        style={{ bottom: keyboardOffset, transition: 'bottom 100ms ease-out' }}
      >
        <div className="flex min-h-11 items-center justify-end px-4 py-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close post details"
            className="flex h-10 w-10 items-center justify-center rounded-full text-text-2 transition hover:bg-surface-2 hover:text-text active:scale-95"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-5 pb-3">
          {loading ? <p className="text-sm text-text-2">Loading post...</p> : null}
          {!loading && error ? <p className="text-sm text-playful">{error}</p> : null}

          {!loading && !error && post ? (
            <>
              <FeedPostCard
                post={{
                  ...post,
                  reactionCount,
                  commentCount,
                  hasReacted,
                }}
                onReact={() => void handleToggleReaction()}
                onOpenDetail={() => undefined}
                onComment={() => undefined}
                onAuthorPress={
                  user && canNavigateToProfile(user.id, post.author.id)
                    ? () => navigateToFeedProfile(post.author.username)
                    : undefined
                }
                onOtherParticipantPress={
                  post.otherParticipant?.username
                    ? () => navigateToFeedProfile(post.otherParticipant!.username!)
                    : undefined
                }
                hideActions
                showReactionInMetaWhenHidden
              />

              <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
                <div className="space-y-3">
                {displayedComments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    onUserPress={
                      user &&
                      comment.user.username &&
                      comment.user.username !== 'me' &&
                      canNavigateToProfile(user.id, comment.user.id)
                        ? () => navigateToFeedProfile(comment.user.username)
                        : undefined
                    }
                  />
                ))}
                {displayedComments.length === 0 ? (
                  <p className="text-sm text-text-2">No comments yet.</p>
                ) : null}
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="border-t border-white/10 bg-surface px-5 pb-3 pt-3">
          <div className="flex items-center gap-2">
            <input
              ref={commentInputRef}
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder="say something..."
              className="min-h-11 flex-1 rounded-md border border-white/10 bg-surface-2 px-3 py-2 text-base text-text placeholder:text-text-3 focus:outline-none"
              maxLength={500}
            />
            <button
              type="button"
              onClick={() => void handleSubmitComment()}
              disabled={submittingComment || commentBody.trim().length === 0}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white disabled:opacity-60"
              aria-label="Send comment"
            >
              <Send size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
