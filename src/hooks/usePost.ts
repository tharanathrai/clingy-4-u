import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.ts'
import type { Bridge, Comment, Post, Reaction, User } from '../types/index.ts'
import { useAuth } from './useAuth.ts'

interface UsePostProps {
  postId: string
}

export interface PostWithDetails extends Post {
  author: User
  bridge: Bridge
  otherParticipant: User | null
  otherParticipantName: string
}

export interface CommentWithUser extends Comment {
  user: User
}

interface UsePostResult {
  post: PostWithDetails | null
  reactionCount: number
  hasReacted: boolean
  comments: CommentWithUser[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function usePost({ postId }: UsePostProps): UsePostResult {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [post, setPost] = useState<PostWithDetails | null>(null)
  const [reactionCount, setReactionCount] = useState(0)
  const [hasReacted, setHasReacted] = useState(false)
  const [comments, setComments] = useState<CommentWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const channelIdRef = useRef(crypto.randomUUID())
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    hasLoadedRef.current = false
  }, [postId, userId])

  const loadPost = useCallback(async () => {
    if (!userId || !postId) {
      setPost(null)
      setReactionCount(0)
      setHasReacted(false)
      setComments([])
      setError(null)
      setLoading(false)
      return
    }

    if (!hasLoadedRef.current) {
      setLoading(true)
    }
    setError(null)

    try {
      const { data: postRow, error: postError } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .maybeSingle()

      if (postError) {
        throw new Error(postError.message)
      }
      if (!postRow) {
        setPost(null)
        setReactionCount(0)
        setHasReacted(false)
        setComments([])
        setLoading(false)
        hasLoadedRef.current = true
        return
      }

      const rawPost = postRow as Post
      const [{ data: authorData, error: authorError }, { data: bridgeData, error: bridgeError }] =
        await Promise.all([
          supabase.from('users').select('*').eq('id', rawPost.author_id).maybeSingle(),
          supabase.from('bridges').select('*').eq('id', rawPost.bridge_id).maybeSingle(),
        ])

      if (authorError) {
        throw new Error(authorError.message)
      }
      if (bridgeError) {
        throw new Error(bridgeError.message)
      }
      if (!authorData || !bridgeData) {
        setPost(null)
        setReactionCount(0)
        setHasReacted(false)
        setComments([])
        setLoading(false)
        hasLoadedRef.current = true
        return
      }

      const bridge = bridgeData as Bridge
      const otherParticipantId =
        bridge.user_a_id === rawPost.author_id ? bridge.user_b_id : bridge.user_a_id

      const { data: otherParticipantData } = await supabase
        .from('users')
        .select('*')
        .eq('id', otherParticipantId)
        .maybeSingle()

      const otherParticipant = (otherParticipantData ?? null) as User | null

      setPost({
        ...rawPost,
        author: authorData as User,
        bridge,
        otherParticipant,
        otherParticipantName: otherParticipant?.display_name ?? 'someone',
      })

      const [{ data: reactionsData, error: reactionsError }, { data: commentsData, error: commentsError }] =
        await Promise.all([
          supabase
            .from('reactions')
            .select('id, post_id, user_id')
            .eq('post_id', postId),
          supabase
            .from('comments')
            .select('*')
            .eq('post_id', postId)
            .order('created_at', { ascending: true }),
        ])

      if (reactionsError) {
        throw new Error(reactionsError.message)
      }
      if (commentsError) {
        throw new Error(commentsError.message)
      }

      const reactionRows = (reactionsData ?? []) as Pick<Reaction, 'id' | 'post_id' | 'user_id'>[]
      const commentRows = (commentsData ?? []) as Comment[]

      setReactionCount(reactionRows.length)
      setHasReacted(reactionRows.some((reaction) => reaction.user_id === userId))

      const commentUserIds = Array.from(new Set(commentRows.map((comment) => comment.user_id)))
      let usersById = new Map<string, User>()
      if (commentUserIds.length > 0) {
        const { data: relatedUsers, error: relatedUsersError } = await supabase
          .from('users')
          .select('*')
          .in('id', commentUserIds)
        if (relatedUsersError) {
          throw new Error(relatedUsersError.message)
        }

        usersById = new Map(
          (relatedUsers ?? []).map((relatedUser) => [relatedUser.id, relatedUser as User]),
        )
      }

      setComments(
        commentRows
          .map((comment) => {
            const relatedUser = usersById.get(comment.user_id)
            if (!relatedUser) {
              return null
            }
            return { ...comment, user: relatedUser } satisfies CommentWithUser
          })
          .filter((comment): comment is CommentWithUser => comment !== null),
      )

      setLoading(false)
      hasLoadedRef.current = true
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load post.')
      setPost(null)
      setReactionCount(0)
      setHasReacted(false)
      setComments([])
      setLoading(false)
      hasLoadedRef.current = true
    }
  }, [postId, userId])

  useEffect(() => {
    if (authLoading) {
      return
    }
    void loadPost()
  }, [authLoading, loadPost])

  useEffect(() => {
    if (!userId || !postId) {
      return
    }

    const channel = supabase
      .channel(`post-${postId}-${channelIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: `id=eq.${postId}`,
        },
        () => {
          void loadPost()
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reactions',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          void loadPost()
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          void loadPost()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadPost, postId, userId])

  return {
    post,
    reactionCount,
    hasReacted,
    comments,
    loading: loading || authLoading,
    error,
    refetch: loadPost,
  }
}
