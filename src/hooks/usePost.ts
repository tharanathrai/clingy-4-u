import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Bridge, Comment, Post, Reaction, User } from '../types/index.ts'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from './useAuth.ts'
import { queryKeys } from '../lib/queryKeys.ts'
import { subscribePostgresChannel } from '../lib/realtime.ts'

export interface PostWithDetails extends Post {
  author: User
  bridge: Bridge
  otherParticipant: User | null
  otherParticipantName: string
}

export interface CommentWithUser extends Comment {
  user: User
}

interface PostQueryResult {
  post: PostWithDetails
  reactionCount: number
  hasReacted: boolean
  comments: CommentWithUser[]
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

async function fetchPost(postId: string, userId: string): Promise<PostQueryResult> {
  const { data: postRow, error: postError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .maybeSingle()

  if (postError) {
    throw new Error(postError.message)
  }
  if (!postRow) {
    throw new Error('Post not found.')
  }

  const rawPost = postRow as Post
  const [{ data: authorData, error: authorError }, { data: bridgeData, error: bridgeError }] =
    await Promise.all([
      supabase.from('users').select('*').eq('id', rawPost.author_id).maybeSingle(),
      supabase.from('bridges').select('*').eq('id', rawPost.bridge_id).maybeSingle(),
    ])

  if (authorError) throw new Error(authorError.message)
  if (bridgeError) throw new Error(bridgeError.message)
  if (!authorData || !bridgeData) throw new Error('Post data incomplete.')

  const bridge = bridgeData as Bridge
  const otherParticipantId =
    bridge.user_a_id === rawPost.author_id ? bridge.user_b_id : bridge.user_a_id

  const { data: otherParticipantData } = await supabase
    .from('users')
    .select('*')
    .eq('id', otherParticipantId)
    .maybeSingle()

  const otherParticipant = (otherParticipantData ?? null) as User | null

  const post: PostWithDetails = {
    ...rawPost,
    author: authorData as User,
    bridge,
    otherParticipant,
    otherParticipantName: otherParticipant?.display_name ?? 'someone',
  }

  const [{ data: reactionsData, error: reactionsError }, { data: commentsData, error: commentsError }] =
    await Promise.all([
      supabase.from('reactions').select('id, post_id, user_id').eq('post_id', postId),
      supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true }),
    ])

  if (reactionsError) throw new Error(reactionsError.message)
  if (commentsError) throw new Error(commentsError.message)

  const reactionRows = (reactionsData ?? []) as Pick<Reaction, 'id' | 'post_id' | 'user_id'>[]
  const commentRows = (commentsData ?? []) as Comment[]

  const commentUserIds = Array.from(new Set(commentRows.map((c) => c.user_id)))
  let usersById = new Map<string, User>()
  if (commentUserIds.length > 0) {
    const { data: relatedUsers, error: relatedUsersError } = await supabase
      .from('users')
      .select('*')
      .in('id', commentUserIds)
    if (relatedUsersError) throw new Error(relatedUsersError.message)
    usersById = new Map(
      (relatedUsers ?? []).map((u) => [u.id, u as User]),
    )
  }

  const comments = commentRows
    .map((comment) => {
      const commentUser = usersById.get(comment.user_id)
      if (!commentUser) return null
      return { ...comment, user: commentUser } satisfies CommentWithUser
    })
    .filter((c): c is CommentWithUser => c !== null)

  return {
    post,
    reactionCount: reactionRows.length,
    hasReacted: reactionRows.some((r) => r.user_id === userId),
    comments,
  }
}

export function usePost({ postId }: { postId: string }): UsePostResult {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const queryClient = useQueryClient()
  const qk = queryKeys.post(postId, userId)

  const { data, isLoading, error } = useQuery({
    queryKey: qk,
    queryFn: () => fetchPost(postId, userId!),
    enabled: !authLoading && userId !== null && Boolean(postId),
    staleTime: 30 * 1000,
  })

  useEffect(() => {
    if (!userId || !postId) return
    const invalidate = () => { void queryClient.invalidateQueries({ queryKey: qk }) }
    return subscribePostgresChannel(`post-rt-${postId}-${userId}`, [
      { event: '*', table: 'posts', filter: `id=eq.${postId}`, callback: invalidate },
      { event: '*', table: 'reactions', filter: `post_id=eq.${postId}`, callback: invalidate },
      { event: '*', table: 'comments', filter: `post_id=eq.${postId}`, callback: invalidate },
    ])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, queryClient, userId])

  return {
    post: data?.post ?? null,
    reactionCount: data?.reactionCount ?? 0,
    hasReacted: data?.hasReacted ?? false,
    comments: data?.comments ?? [],
    loading: authLoading || isLoading,
    error: error instanceof Error ? error.message : null,
    refetch: async () => {
      await queryClient.invalidateQueries({ queryKey: qk })
    },
  }
}
