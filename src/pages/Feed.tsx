import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FeedPostCard } from '../components/feed/FeedPostCard.tsx'
import { PostDetailSheet } from '../components/feed/PostDetailSheet.tsx'
import { Layout } from '../components/layout/Layout.tsx'
import { EmptyStateIllustration } from '../components/EmptyStateIllustration.tsx'
import { useFeed, type FeedPost } from '../hooks/useFeed.ts'
import { usePaginatedItems } from '../hooks/usePaginatedItems.ts'
import { useScrollRestore } from '../hooks/useScrollRestore.ts'
import { useAuth } from '../hooks/useAuth.ts'
import { supabase } from '../lib/supabase.ts'

export default function Feed() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const { posts, loading, error, refetch } = useFeed()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [localPosts, setLocalPosts] = useState(posts)
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [focusComposerOnOpen, setFocusComposerOnOpen] = useState(false)
  const [animatedPostIds, setAnimatedPostIds] = useState<Set<string>>(new Set())
  const knownPostIdsRef = useRef<Set<string>>(new Set())
  const hasPostDetailHistoryEntryRef = useRef(false)
  const {
    visibleItems: visiblePosts,
    hasMore,
    loadMore,
  } = usePaginatedItems(localPosts, 6, 'pagination:/feed')
  useScrollRestore('scroll:/feed', `${loading ? 'loading' : 'ready'}:${visiblePosts.length}`)

  useEffect(() => {
    setLocalPosts(posts)
  }, [posts])

  useEffect(() => {
    const currentIds = localPosts.map((post) => post.id)
    const knownIds = knownPostIdsRef.current
    const isFirstPaint = knownIds.size === 0
    const newIds = currentIds.filter((id) => !knownIds.has(id))

    knownPostIdsRef.current = new Set(currentIds)

    if (isFirstPaint || newIds.length === 0) {
      return
    }

    setAnimatedPostIds(new Set(newIds))
    const timeoutId = window.setTimeout(() => {
      setAnimatedPostIds(new Set())
    }, 450)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [localPosts])

  useEffect(() => {
    if (!selectedPostId || hasPostDetailHistoryEntryRef.current) {
      return
    }

    const nextState =
      typeof window.history.state === 'object' && window.history.state !== null
        ? window.history.state
        : {}
    window.history.pushState({ ...nextState, feedPostDetailOpen: true }, '', window.location.href)
    hasPostDetailHistoryEntryRef.current = true
  }, [selectedPostId])

  useEffect(() => {
    if (!selectedPostId) {
      setFocusComposerOnOpen(false)
      return
    }

    const handlePopState = () => {
      if (selectedPostId) {
        setSelectedPostId(null)
      }
      hasPostDetailHistoryEntryRef.current = false
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [selectedPostId])

  const toggleReactionMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error: fnError } = await supabase.functions.invoke('toggle-reaction', {
        body: { post_id: postId },
      })
      if (fnError) throw fnError
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ['feed', userId] })
      const previous = queryClient.getQueryData<FeedPost[]>(['feed', userId])
      const applyToggle = (list: FeedPost[]) =>
        list.map((post) => {
          if (post.id !== postId) return post
          const nextHasReacted = !post.hasReacted
          return {
            ...post,
            hasReacted: nextHasReacted,
            reactionCount: Math.max(0, post.reactionCount + (nextHasReacted ? 1 : -1)),
          }
        })
      queryClient.setQueryData<FeedPost[]>(['feed', userId], (current) =>
        current ? applyToggle(current) : current,
      )
      setLocalPosts((current) => applyToggle(current))
      return { previous }
    },
    onError: (_err, _postId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['feed', userId], context.previous)
        setLocalPosts(context.previous)
      }
    },
  })

  const handleReact = (postId: string) => {
    toggleReactionMutation.mutate(postId)
  }

  const openPostDetail = (postId: string, options?: { focusComposer?: boolean }) => {
    setFocusComposerOnOpen(options?.focusComposer === true)
    setSelectedPostId(postId)
  }

  return (
    <Layout>
      <main>
        <h1 className="app-page-title">feed</h1>

        {loading ? (
          <section className="mt-8 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="skeleton h-44 rounded-lg" />
            ))}
          </section>
        ) : null}

        {!loading && error ? (
          <section className="mt-8 rounded-lg bg-surface p-6 text-center">
            <p className="text-sm text-text-2">Couldn&apos;t load your feed. Try again.</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-4 rounded-full bg-surface-2 px-5 py-2 text-sm text-text-2"
            >
              Retry
            </button>
          </section>
        ) : null}

        {!loading && !error && localPosts.length === 0 ? (
          <section className="mt-8 rounded-lg bg-surface p-6 text-center">
            <EmptyStateIllustration variant="bridge" />
            <h2 className="font-display text-2xl text-text">Nothing here yet.</h2>
            <p className="mt-2 text-sm text-text-2">
              Your feed fills up when your people do things together.
            </p>
          </section>
        ) : null}

        {!loading && !error && localPosts.length > 0 ? (
          <ul className="mt-5 space-y-3">
            {visiblePosts.map((post) => (
              <li
                key={post.id}
                className={animatedPostIds.has(post.id) ? 'feed-post-enter' : undefined}
              >
                <FeedPostCard
                  post={post}
                  onReact={() => void handleReact(post.id)}
                  onOpenDetail={() => openPostDetail(post.id)}
                  onComment={() => openPostDetail(post.id, { focusComposer: true })}
                  onAuthorPress={() => navigate(`/profile/${post.author.username}`)}
                />
              </li>
            ))}
          </ul>
        ) : null}

        {!loading && !error && hasMore ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={loadMore}
              className="rounded-full bg-surface-2 px-5 py-2 text-sm text-text-2"
            >
              Load more
            </button>
          </div>
        ) : null}
      </main>

      <PostDetailSheet
        postId={selectedPostId}
        autoFocusComposer={focusComposerOnOpen}
        onClose={() => {
          if (hasPostDetailHistoryEntryRef.current) {
            window.history.back()
            return
          }
          setSelectedPostId(null)
        }}
        onPostMetricsChange={(next) => {
          setLocalPosts((current) =>
            current.map((post) =>
              post.id === next.postId
                ? {
                    ...post,
                    reactionCount: next.reactionCount,
                    commentCount: next.commentCount,
                    hasReacted: next.hasReacted,
                  }
                : post,
            ),
          )
        }}
      />
    </Layout>
  )
}
