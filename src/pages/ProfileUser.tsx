import { useMemo } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { BackHeader } from '../components/layout/BackHeader.tsx'
import { CategoryBreakdownRow } from '../components/profile/CategoryBreakdownRow.tsx'
import { Gumball } from '../components/profile/Gumball.tsx'
import { SharedBridgesSection } from '../components/profile/SharedBridgesSection.tsx'
import { pageShellTab } from '../components/layout/pageShell.ts'
import { useAuth } from '../hooks/useAuth.ts'
import { useProfile } from '../hooks/useProfile.ts'
import { CATEGORIES, type CategorySlug } from '../lib/constants.ts'
import {
  type AppLocationState,
  profileBackReturnState,
} from '../lib/navigationContext.ts'

export default function ProfileUser() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()
  const {
    profile,
    connectionCount,
    categoryBreakdown,
    bridgeCount,
    sharedBridges,
    isConnected,
    loading,
    error,
    refetch,
  } = useProfile({ username })

  const categoriesWithBridges = useMemo(() => {
    return Object.keys(CATEGORIES)
      .map((category) => category as CategorySlug)
      .filter((category) => categoryBreakdown[category] > 0)
      .sort((a, b) => categoryBreakdown[b] - categoryBreakdown[a])
  }, [categoryBreakdown])

  const handleBack = () => {
    const state = location.state as AppLocationState | null
    if (state?.returnTo) {
      navigate(state.returnTo, { state: profileBackReturnState(state) })
      return
    }
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/home')
  }

  if (authLoading || loading) {
    return (
      <main className={pageShellTab}>
        <BackHeader onBack={handleBack} className="mb-4" />
        <section className="flex flex-col items-center">
          <div className="skeleton h-20 w-20 rounded-full" />
          <div className="skeleton mt-4 h-7 w-44 rounded-full" />
          <div className="skeleton mt-2 h-4 w-28 rounded-full" />
        </section>
        <section className="mt-8 flex flex-col items-center">
          <div className="skeleton h-40 w-40 rounded-full" />
        </section>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (!profile) {
    return (
      <main className={pageShellTab}>
        <BackHeader onBack={handleBack} className="mb-4" />
        <h1 className="app-page-title">profile</h1>
        {error ? (
          <>
            <p className="mt-4 text-sm text-text-2">Couldn&apos;t load this profile.</p>
            <button
              type="button"
              onClick={refetch}
              className="mt-8 rounded-full bg-surface-2 px-7 py-3.5 text-center text-sm font-medium text-text-2"
            >
              Retry
            </button>
          </>
        ) : (
          <p className="mt-4 text-sm text-text-2">Profile not found.</p>
        )}
      </main>
    )
  }

  if (profile.id === user.id) {
    return <Navigate to="/profile/me" replace />
  }

  return (
    <main className={pageShellTab}>
      <BackHeader onBack={handleBack} className="mb-4" />
      <section className="flex flex-col items-center text-center">
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
        <h1 className="app-page-title mt-3">{profile.display_name}</h1>
        <p className="mt-1 text-sm text-text-2">@{profile.username}</p>
        <p className="mt-3 text-sm italic text-text-2">
          {profile.bio ?? 'New here — no bridges yet.'}
        </p>

        {!isConnected ? (
          <Link
            to="/add"
            className="btn-primary mt-4 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white"
          >
            Add {profile.display_name}
          </Link>
        ) : null}
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

      {isConnected ? (
        <SharedBridgesSection bridges={sharedBridges} otherUser={profile} />
      ) : null}
    </main>
  )
}
