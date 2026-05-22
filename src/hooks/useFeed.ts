import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Bridge, Comment, Post, Reaction, User } from '../types/index.ts'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from './useAuth.ts'

export interface FeedPost extends Post {
  author: User
  bridge: Bridge
  otherParticipantName: string
  reactionCount: number
  commentCount: number
  hasReacted: boolean
}

interface UseFeedResult {
  posts: FeedPost[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

interface ConnectionRow {
  user_a_id: string
  user_b_id: string
}

async function fetchFeed(userId: string): Promise<FeedPost[]> {
  const { data: connectionsData, error: connectionsError } = await supabase
    .from('connections')
    .select('user_a_id, user_b_id')
    .eq('status', 'active')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)

  if (connectionsError) {
    throw new Error(connectionsError.message)
  }

  const connections = (connectionsData ?? []) as ConnectionRow[]
  const connectedUserIds = Array.from(
    new Set(
      connections.map((c) =>
        c.user_a_id === userId ? c.user_b_id : c.user_a_id,
      ),
    ),
  )

  const { data: ownPostsData, error: ownPostsError } = await supabase
    .from('posts')
    .select('*')
    .eq('author_id', userId)

  if (ownPostsError) {
    throw new Error(ownPostsError.message)
  }

  let networkPosts: Post[] = []
  if (connectedUserIds.length > 0) {
    const { data: networkPostsData, error: networkPostsError } = await supabase
      .from('posts')
      .select('*')
      .eq('is_public', true)
      .in('author_id', connectedUserIds)

    if (networkPostsError) {
      throw new Error(networkPostsError.message)
    }
    networkPosts = (networkPostsData ?? []) as Post[]
  }

  const dedupedPosts = Array.from(
    new Map(
      ([...((ownPostsData ?? []) as Post[]), ...networkPosts]).map((post) => [post.id, post]),
    ).values(),
  ).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  if (dedupedPosts.length === 0) {
    return []
  }

  const postIds = dedupedPosts.map((post) => post.id)
  const bridgeIds = Array.from(new Set(dedupedPosts.map((post) => post.bridge_id)))

  const { data: bridgesData, error: bridgesError } = await supabase
    .from('bridges')
    .select('*')
    .in('id', bridgeIds)

  if (bridgesError) {
    throw new Error(bridgesError.message)
  }

  const bridges = (bridgesData ?? []) as Bridge[]
  const userIds = Array.from(
    new Set([
      ...dedupedPosts.map((post) => post.author_id),
      ...bridges.flatMap((bridge) => [bridge.user_a_id, bridge.user_b_id]),
    ]),
  )

  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('*')
    .in('id', userIds)

  if (usersError) {
    throw new Error(usersError.message)
  }

  const [{ data: reactionsData, error: reactionsError }, { data: commentsData, error: commentsError }] =
    await Promise.all([
      supabase.from('reactions').select('id, post_id, user_id').in('post_id', postIds),
      supabase.from('comments').select('id, post_id').in('post_id', postIds),
    ])

  if (reactionsError) {
    throw new Error(reactionsError.message)
  }
  if (commentsError) {
    throw new Error(commentsError.message)
  }

  const usersById = new Map((usersData ?? []).map((profile) => [profile.id, profile as User]))
  const bridgesById = new Map(bridges.map((bridge) => [bridge.id, bridge]))
  const reactions = (reactionsData ?? []) as Pick<Reaction, 'id' | 'post_id' | 'user_id'>[]
  const comments = (commentsData ?? []) as Pick<Comment, 'id' | 'post_id'>[]

  const reactionCountByPostId = new Map<string, number>()
  const hasReactedByPostId = new Map<string, boolean>()
  for (const reaction of reactions) {
    reactionCountByPostId.set(
      reaction.post_id,
      (reactionCountByPostId.get(reaction.post_id) ?? 0) + 1,
    )
    if (reaction.user_id === userId) {
      hasReactedByPostId.set(reaction.post_id, true)
    }
  }

  const commentCountByPostId = new Map<string, number>()
  for (const comment of comments) {
    commentCountByPostId.set(
      comment.post_id,
      (commentCountByPostId.get(comment.post_id) ?? 0) + 1,
    )
  }

  return dedupedPosts
    .map((post) => {
      const author = usersById.get(post.author_id)
      const bridge = bridgesById.get(post.bridge_id)
      if (!author || !bridge) {
        return null
      }

      const otherParticipantId =
        bridge.user_a_id === author.id ? bridge.user_b_id : bridge.user_a_id
      const otherParticipantName =
        usersById.get(otherParticipantId)?.display_name ?? 'someone'

      return {
        ...post,
        author,
        bridge,
        otherParticipantName,
        reactionCount: reactionCountByPostId.get(post.id) ?? 0,
        commentCount: commentCountByPostId.get(post.id) ?? 0,
        hasReacted: hasReactedByPostId.get(post.id) ?? false,
      } satisfies FeedPost
    })
    .filter((post): post is FeedPost => post !== null)
}

export function useFeed(): UseFeedResult {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['feed', userId],
    queryFn: () => fetchFeed(userId!),
    enabled: !authLoading && userId !== null,
    staleTime: 60 * 1000,
  })

  // Real-time: invalidate on posts/reactions/comments changes
  useEffect(() => {
    if (!userId) {
      return
    }

    const channel = supabase
      .channel(`feed-rt-${userId}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['feed', userId] })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reactions' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['feed', userId] })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['feed', userId] })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient, userId])

  return {
    posts: data ?? [],
    loading: authLoading || isLoading,
    error: error instanceof Error ? error.message : null,
    refetch: async () => {
      await queryClient.invalidateQueries({ queryKey: ['feed', userId] })
    },
  }
}
