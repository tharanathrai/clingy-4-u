import { Heart, Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.ts'
import { type CommentWithUser, usePost } from '../../hooks/usePost.ts'
import { supabase } from '../../lib/supabase.ts'
import { CommentItem } from './CommentItem.tsx'
import { FeedPostCard } from './FeedPostCard.tsx'

interface PostDetailSheetProps {
  postId: string | null
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
  onClose,
  onPostMetricsChange,
}: PostDetailSheetProps) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const navigate = useNavigate()
  const [commentBody, setCommentBody] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [submittingReaction, setSubmittingReaction] = useState(false)
  const { post, reactions, comments, loading, error } = usePost({
    postId: postId ?? '',
  })
  const [optimisticReactionCount, setOptimisticReactionCount] = useState<number | null>(
    null,
  )
  const [optimisticHasReacted, setOptimisticHasReacted] = useState<boolean | null>(null)
  const [optimisticCommentCount, setOptimisticCommentCount] = useState<number | null>(null)
  const [optimisticComments, setOptimisticComments] = useState<CommentWithUser[]>([])

  useEffect(() => {
    setOptimisticReactionCount(null)
    setOptimisticHasReacted(null)
    setOptimisticCommentCount(null)
    setOptimisticComments([])
  }, [postId])

  const hasReacted = useMemo(() => {
    if (optimisticHasReacted !== null) {
      return optimisticHasReacted
    }
    if (!userId) {
      return false
    }
    return reactions.some((reaction) => reaction.user_id === userId)
  }, [optimisticHasReacted, reactions, userId])

  const recentReactors = useMemo(() => {
    return reactions.slice(0, 5)
  }, [reactions])

  const reactionCount = optimisticReactionCount ?? reactions.length
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

  const handleToggleReaction = async () => {
    if (submittingReaction || !postId) {
      return
    }
    setSubmittingReaction(true)
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
    setSubmittingReaction(false)
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
    <section className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close post details"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      <div className="absolute inset-x-0 bottom-0 top-6 flex flex-col rounded-t-xl border-t border-white/10 bg-surface">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close post details"
          className="flex justify-center py-3"
        >
          <span className="h-1 w-9 rounded-full bg-white/20" />
        </button>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
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
                onComment={() => undefined}
                onOtherParticipantPress={
                  post.otherParticipant?.username
                    ? () => navigate(`/profile/${post.otherParticipant?.username}`)
                    : undefined
                }
                hideActions
              />

              <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-2 px-4 py-3">
                <div className="flex items-center">
                  {recentReactors.map((reaction, index) => (
                    <button
                      type="button"
                      key={reaction.id}
                      onClick={() => navigate(`/profile/${reaction.user.username}`)}
                      className={`relative ${index === 0 ? '' : '-ml-2'}`}
                    >
                      {reaction.user.avatar_url ? (
                        <img
                          src={reaction.user.avatar_url}
                          alt={reaction.user.display_name}
                          className="h-7 w-7 rounded-full border border-surface object-cover"
                        />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-surface bg-bg text-xs text-text-2">
                          {reaction.user.display_name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => void handleToggleReaction()}
                  disabled={submittingReaction}
                  className="inline-flex items-center gap-2 text-sm text-text-2 disabled:opacity-60"
                >
                  <Heart
                    size={18}
                    strokeWidth={1.75}
                    className={hasReacted ? 'text-accent' : 'text-text-2'}
                    fill={hasReacted ? 'currentColor' : 'none'}
                  />
                  <span>{reactionCount}</span>
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {displayedComments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    onUserPress={
                      comment.user.username && comment.user.username !== 'me'
                        ? () => navigate(`/profile/${comment.user.username}`)
                        : undefined
                    }
                  />
                ))}
                {displayedComments.length === 0 ? (
                  <p className="text-sm text-text-2">No comments yet.</p>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        <div className="border-t border-white/10 bg-surface px-5 pb-4 pt-3">
          <div className="flex items-center gap-2">
            <input
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder="say something..."
              className="min-h-10 flex-1 rounded-md border border-white/10 bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-3 focus:outline-none"
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
