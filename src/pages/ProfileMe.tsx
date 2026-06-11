import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { CategoryBreakdownRow } from '../components/profile/CategoryBreakdownRow.tsx'
import { EditProfileSheet } from '../components/profile/EditProfileSheet.tsx'
import { Gumball } from '../components/profile/Gumball.tsx'
import { ProfileMeHeader, ProfileMeHeaderSkeleton } from '../components/profile/ProfileMeHeader.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { useProfile } from '../hooks/useProfile.ts'
import { CATEGORIES, type CategorySlug } from '../lib/constants.ts'
import { supabase } from '../lib/supabase.ts'

export default function ProfileMe() {
  const { user, loading } = useAuth()
  const {
    profile,
    connectionCount,
    categoryBreakdown,
    bridgeCount,
    loading: profileLoading,
    error,
    refetch,
  } = useProfile({ userId: user?.id })
  const [isEditing, setIsEditing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const bioAttemptedRef = useRef(false)

  const generateBioMutation = useMutation({
    mutationFn: async () => {
      const { data, error: invokeError } = await supabase.functions.invoke('generate-profile-bio')
      if (invokeError) throw invokeError
      return data
    },
    onSuccess: () => {
      refetch()
    },
  })

  useEffect(() => {
    if (!toast) return
    const timeoutId = window.setTimeout(() => setToast(null), 2500)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  // Auto-generate bio once when profile loads without one
  useEffect(() => {
    if (!profile || profile.bio || bioAttemptedRef.current || generateBioMutation.isPending) return
    bioAttemptedRef.current = true
    generateBioMutation.mutate()
  }, [generateBioMutation, profile])

  const categoriesWithBridges = useMemo(() => {
    return Object.keys(CATEGORIES)
      .map((category) => category as CategorySlug)
      .filter((category) => categoryBreakdown[category] > 0)
      .sort((a, b) => categoryBreakdown[b] - categoryBreakdown[a])
  }, [categoryBreakdown])

  if (loading || profileLoading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-bg px-5 pb-28 pt-8 text-text">
        <ProfileMeHeaderSkeleton />
        <section className="mt-2 flex flex-col items-center text-center">
          <div className="skeleton h-20 w-20 rounded-full" />
          <div className="skeleton mt-3 h-7 w-36 rounded" />
          <div className="skeleton mt-1 h-4 w-24 rounded" />
          <div className="skeleton mt-3 h-4 w-48 rounded" />
          <div className="skeleton mt-4 h-9 w-28 rounded-full" />
        </section>
        <section className="mt-8 flex flex-col items-center">
          <div className="skeleton h-40 w-40 rounded-full" />
          <div className="skeleton mt-4 h-4 w-40 rounded" />
        </section>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (!profile) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-bg px-5 py-8 text-text">
        <ProfileMeHeader />
        <h1 className="font-display text-4xl">My profile</h1>
        <p className="mt-4 text-sm text-text-2">
          {error ?? 'Profile not found. Complete onboarding first.'}
        </p>
        <Link
          to="/welcome"
          className="mt-8 rounded-full bg-accent px-7 py-3.5 text-center text-sm font-medium text-white"
        >
          Finish onboarding
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-bg px-5 pb-28 pt-8 text-text">
      <ProfileMeHeader />

      <section className="mt-2 flex flex-col items-center text-center">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.display_name}
            className="h-20 w-20 rounded-full border-2 border-white object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white bg-surface-2 text-2xl text-text">
            {profile.display_name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <h2 className="mt-3 font-display text-2xl text-text">{profile.display_name}</h2>
        <p className="mt-1 text-sm text-text-2">@{profile.username}</p>
        <p className="mt-3 text-sm italic text-text-2">
          {profile.bio ?? (generateBioMutation.isPending ? 'Generating your bio...' : 'New here — no bridges yet.')}
        </p>
        <button
          type="button"
          className="mt-4 rounded-full bg-surface-2 px-5 py-2.5 text-sm text-text-2"
          onClick={() => {
            setIsEditing(true)
          }}
        >
          Edit profile
        </button>
      </section>

      <section className="mt-8 flex flex-col items-center">
        <Gumball categoryBreakdown={categoryBreakdown} size={160} />
        <p className="mt-4 text-center text-sm text-text-2">
          chewed gum with {connectionCount} {connectionCount === 1 ? 'person' : 'people'}
        </p>
        <Link
          to="/add"
          className="mt-3 rounded-full bg-surface-2 px-4 py-2 text-xs font-medium text-text-2"
        >
          Add someone
        </Link>
      </section>

      {bridgeCount > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-2xl text-text">category breakdown</h2>
          <div className="mt-3 space-y-3">
            {categoriesWithBridges.map((category) => (
              <CategoryBreakdownRow
                key={category}
                category={category}
                count={categoryBreakdown[category]}
                total={bridgeCount}
              />
            ))}
          </div>
        </section>
      ) : null}

      {toast ? (
        <div className="app-fixed-frame safe-bottom-24 px-5">
          <p className="app-fixed-frame-inner rounded-md bg-surface-2 px-4 py-3 text-center text-sm text-text">
            {toast}
          </p>
        </div>
      ) : null}

      <EditProfileSheet
        profile={profile}
        isOpen={isEditing}
        onClose={() => {
          setIsEditing(false)
        }}
        onSaved={() => {
          setIsEditing(false)
          setToast('Profile updated.')
          refetch()
        }}
      />
    </main>
  )
}
