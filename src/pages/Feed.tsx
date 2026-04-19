import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FeedPostCard } from '../components/feed/FeedPostCard.tsx'
import { PostDetailSheet } from '../components/feed/PostDetailSheet.tsx'
import { Layout } from '../components/layout/Layout.tsx'
import { useFeed } from '../hooks/useFeed.ts'
import { supabase } from '../lib/supabase.ts'

export default function Feed() {
  const { posts, loading, error, refetch } = useFeed()
  const navigate = useNavigate()
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [animatedPostIds, setAnimatedPostIds] = useState<Set<string>>(new Set())
  const knownPostIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const currentIds = posts.map((post) => post.id)
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
  }, [posts])

  const handleReact = async (postId: string) => {
    await supabase.functions.invoke('toggle-reaction', {
      body: { post_id: postId },
    })
    await refetch()
  }

  return (
    <Layout>
      <main className="pb-28">
        <h1 className="font-display text-4xl text-text">feed</h1>

        {loading ? (
          <section className="mt-8 rounded-lg bg-surface p-6 text-center">
            <p className="text-sm text-text-2">Loading your feed...</p>
          </section>
        ) : null}

        {!loading && error ? (
          <section className="mt-8 rounded-lg bg-surface p-6 text-center">
            <p className="text-sm text-playful">{error}</p>
          </section>
        ) : null}

        {!loading && !error && posts.length === 0 ? (
          <section className="mt-8 rounded-lg bg-surface p-6 text-center">
            <h2 className="font-display text-2xl text-text">Nothing here yet.</h2>
            <p className="mt-2 text-sm text-text-2">
              Your feed fills up when your people do things together.
            </p>
          </section>
        ) : null}

        {!loading && !error && posts.length > 0 ? (
          <ul className="mt-5 space-y-3">
            {posts.map((post) => (
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
      </main>

      <PostDetailSheet
        postId={selectedPostId}
        onClose={() => setSelectedPostId(null)}
        onActivityChange={() => {
          void refetch()
        }}
      />
    </Layout>
  )
}
