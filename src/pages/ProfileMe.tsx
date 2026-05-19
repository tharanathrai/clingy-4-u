import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { CategoryBreakdownRow } from '../components/profile/CategoryBreakdownRow.tsx'
import { EditProfileSheet } from '../components/profile/EditProfileSheet.tsx'
import { Gumball } from '../components/profile/Gumball.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { useProfile } from '../hooks/useProfile.ts'
import { CATEGORIES, type CategorySlug } from '../lib/constants.ts'
import { supabase } from '../lib/supabase.ts'
import type { User } from '../types/index.ts'

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
  const [generatingBio, setGeneratingBio] = useState(false)
  const [attemptedBioGeneration, setAttemptedBioGeneration] = useState(false)

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null)
    }, 2500)

    return () => window.clearTimeout(timeoutId)
  }, [toast])

  useEffect(() => {
    if (profile?.bio) {
      setAttemptedBioGeneration(false)
    }
  }, [profile?.bio])

  useEffect(() => {
    if (!profile || profile.bio || generatingBio) {
      return
    }
    if (attemptedBioGeneration) {
      return
    }

    let cancelled = false
    const generateBio = async () => {
      setAttemptedBioGeneration(true)
      setGeneratingBio(true)
      const { data, error: invokeError } =
        await supabase.functions.invoke('generate-profile-bio')

      if (cancelled) {
        return
      }

      if (!invokeError && data) {
        refetch()
      }
      setGeneratingBio(false)
    }

    void generateBio()

    return () => {
      cancelled = true
    }
  }, [attemptedBioGeneration, generatingBio, profile, refetch])

  const categoriesWithBridges = useMemo(() => {
    return Object.keys(CATEGORIES)
      .map((category) => category as CategorySlug)
      .filter((category) => categoryBreakdown[category] > 0)
      .sort((a, b) => categoryBreakdown[b] - categoryBreakdown[a])
  }, [categoryBreakdown])

  if (loading || profileLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-5 text-text">
        <p className="text-sm text-text-2">Loading profile...</p>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (!profile) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-bg px-5 py-8 text-text">
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
      <h1 className="app-page-title">your profile</h1>
      <section className="mt-6 flex flex-col items-center text-center">
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
          {profile.bio ?? (generatingBio ? 'Generating your bio...' : 'New here — no bridges yet.')}
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

      <div className="mt-10">
        <Link to="/home/graveyard" className="text-sm text-text-3">
          graveyard →
        </Link>
      </div>

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
        onSaved={(_updatedProfile: User) => {
          setIsEditing(false)
          setToast('Profile updated.')
          refetch()
        }}
      />
    </main>
  )
}
