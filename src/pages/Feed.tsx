import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FeedPostCard } from '../components/feed/FeedPostCard.tsx'
import { PostDetailSheet } from '../components/feed/PostDetailSheet.tsx'
import { Layout } from '../components/layout/Layout.tsx'
import { EmptyStateIllustration } from '../components/EmptyStateIllustration.tsx'
import { useFeed } from '../hooks/useFeed.ts'
import { usePaginatedItems } from '../hooks/usePaginatedItems.ts'
import { useScrollRestore } from '../hooks/useScrollRestore.ts'
import { supabase } from '../lib/supabase.ts'

export default function Feed() {
  const { posts, loading, error, refetch } = useFeed()
  const navigate = useNavigate()
  const [localPosts, setLocalPosts] = useState(posts)
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [animatedPostIds, setAnimatedPostIds] = useState<Set<string>>(new Set())
  const knownPostIdsRef = useRef<Set<string>>(new Set())
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

  const handleReact = async (postId: string) => {
    setLocalPosts((current) =>
      current.map((post) => {
        if (post.id !== postId) {
          return post
        }

        const nextHasReacted = !post.hasReacted
        return {
          ...post,
          hasReacted: nextHasReacted,
          reactionCount: Math.max(
            0,
            post.reactionCount + (nextHasReacted ? 1 : -1),
          ),
        }
      }),
    )

    await supabase.functions.invoke('toggle-reaction', {
      body: { post_id: postId },
    })
  }

  return (
    <Layout>
      <main className="pb-28">
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
                  onComment={() => setSelectedPostId(post.id)}
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
        onClose={() => setSelectedPostId(null)}
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
