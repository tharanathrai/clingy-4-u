import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toastFrameClass } from '../components/layout/pageShell.ts'
import { FeedPostCard } from '../components/feed/FeedPostCard.tsx'
import { PostDetailSheet } from '../components/feed/PostDetailSheet.tsx'
import { Layout } from '../components/layout/Layout.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { ErrorState } from '../components/ErrorState.tsx'
import { FullScreenSpinner } from '../components/Spinner.tsx'
import { useConnectionsCount } from '../hooks/useConnectionsCount.ts'
import { useFeed, type FeedPost } from '../hooks/useFeed.ts'
import type { PostQueryResult } from '../hooks/usePost.ts'
import { usePaginatedItems } from '../hooks/usePaginatedItems.ts'
import { useScrollRestore } from '../hooks/useScrollRestore.ts'
import { useAuth } from '../hooks/useAuth.ts'
import { queryKeys } from '../lib/queryKeys.ts'
import { supabase } from '../lib/supabase.ts'
import { track } from '../lib/analytics.ts'
import {
  type AppLocationState,
  canNavigateToProfile,
  navigateToProfile,
} from '../lib/navigationContext.ts'

export default function Feed() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const { posts, loading, error, refetch } = useFeed()
  const { connectionsCount } = useConnectionsCount()
  const navigate = useNavigate()
  const location = useLocation()
  const restorePostIdFromState = (location.state as AppLocationState | null)?.restorePostId
  const queryClient = useQueryClient()
  const [localPosts, setLocalPosts] = useState(posts)
  const [toast, setToast] = useState<string | null>(null)
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [focusComposerOnOpen, setFocusComposerOnOpen] = useState(false)
  const [animatedPostIds, setAnimatedPostIds] = useState<Set<string>>(new Set())
  const knownPostIdsRef = useRef<Set<string>>(new Set())
  const hasPostDetailHistoryEntryRef = useRef(false)
  const feedEnteredAtRef = useRef<number>(Date.now())

  useEffect(() => {
    feedEnteredAtRef.current = Date.now()
    return () => {
      track('feed_dwell', { dwell_ms: Date.now() - feedEnteredAtRef.current }, 'feed')
    }
  }, [])
  const {
    visibleItems: visiblePosts,
    hasMore,
    loadMore,
  } = usePaginatedItems(localPosts, 6, 'pagination:/feed')
  useScrollRestore('scroll:/feed', `${loading ? 'loading' : 'ready'}:${visiblePosts.length}`)

  useEffect(() => {
    if (!restorePostIdFromState) {
      return
    }

    setFocusComposerOnOpen(false)
    setSelectedPostId(restorePostIdFromState)
    navigate('.', { replace: true, state: {} })
  }, [restorePostIdFromState, navigate])

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
    if (!toast) return
    const toastId = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(toastId)
  }, [toast])

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
      await queryClient.cancelQueries({ queryKey: queryKeys.feed(userId) })
      await queryClient.cancelQueries({ queryKey: queryKeys.post(postId, userId) })
      const previous = queryClient.getQueryData<FeedPost[]>(queryKeys.feed(userId))
      const previousPost = queryClient.getQueryData<PostQueryResult>(queryKeys.post(postId, userId))
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
      queryClient.setQueryData<FeedPost[]>(queryKeys.feed(userId), (current) =>
        current ? applyToggle(current) : current,
      )
      setLocalPosts((current) => applyToggle(current))
      if (previousPost) {
        const nextHasReacted = !previousPost.hasReacted
        queryClient.setQueryData<PostQueryResult>(queryKeys.post(postId, userId), {
          ...previousPost,
          hasReacted: nextHasReacted,
          reactionCount: Math.max(0, previousPost.reactionCount + (nextHasReacted ? 1 : -1)),
        })
      }
      return { previous, previousPost }
    },
    onError: (_err, postId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.feed(userId), context.previous)
        setLocalPosts(context.previous)
      }
      if (context?.previousPost) {
        queryClient.setQueryData<PostQueryResult>(queryKeys.post(postId, userId), context.previousPost)
      }
      setToast('Could not react — try again.')
    },
  })

  const handleReact = (postId: string) => {
    toggleReactionMutation.mutate(postId)
  }

  const openPostDetail = (postId: string, options?: { focusComposer?: boolean }) => {
    setFocusComposerOnOpen(options?.focusComposer === true)
    setSelectedPostId(postId)
  }

  if (loading) {
    return <FullScreenSpinner />
  }

  return (
    <Layout>
      <main>
        <h1 className="app-page-title">the feed</h1>

        {error ? (
          <ErrorState message="Couldn't load your feed." onRetry={() => void refetch()} />
        ) : null}

        {!error && localPosts.length === 0 ? (
          connectionsCount === 0 ? (
            <EmptyState
              variant="bridge"
              headline="Nothing here yet."
              subline="Add someone first — your feed fills up once your people stick plans together."
              cta={{ label: 'Add someone', to: '/add' }}
            />
          ) : (
            <EmptyState
              variant="bridge"
              headline="Nothing here yet."
              subline="Your feed fills up when your people stick plans together."
              cta={{ label: 'Make a plan', to: '/piece/new' }}
            />
          )
        ) : null}

        {!error && localPosts.length > 0 ? (
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
                  onAuthorPress={
                    canNavigateToProfile(userId, post.author.id)
                      ? () =>
                          navigateToProfile(navigate, {
                            username: post.author.username,
                            returnTo: '/feed',
                          })
                      : undefined
                  }
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

      {toast ? (
        <div className={toastFrameClass}>
          <p className="app-fixed-frame-inner rounded-md bg-surface-2 px-4 py-3 text-center text-sm text-text">
            {toast}
          </p>
        </div>
      ) : null}

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
          const applyMetrics = (list: FeedPost[]) =>
            list.map((post) =>
              post.id === next.postId
                ? { ...post, reactionCount: next.reactionCount, commentCount: next.commentCount, hasReacted: next.hasReacted }
                : post,
            )
          setLocalPosts((current) => applyMetrics(current))
          queryClient.setQueryData<FeedPost[]>(queryKeys.feed(userId), (current) =>
            current ? applyMetrics(current) : current,
          )
        }}
      />
    </Layout>
  )
}
