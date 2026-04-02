import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.ts'
import { supabase } from '../lib/supabase.ts'
import type { User } from '../types/index.ts'

export default function ProfileMe() {
  const { user, loading } = useAuth()
  const [profile, setProfile] = useState<User | null>(null)
  const [fetching, setFetching] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setFetching(false)
      return
    }

    let active = true

    const loadProfile = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (!active) {
        return
      }

      if (error) {
        setErrorMessage('Something went wrong - try again.')
        setFetching(false)
        return
      }

      setProfile(data)
      setFetching(false)
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [user])

  if (loading || fetching) {
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
          {errorMessage ?? 'Profile not found. Complete onboarding first.'}
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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-bg px-5 py-8 text-text">
      <h1 className="font-display text-4xl">My profile</h1>

      <section className="mt-8 rounded-lg border border-white/10 bg-surface p-6">
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-lg font-medium">
              {profile.display_name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-lg text-text">{profile.display_name}</p>
            <p className="text-sm text-text-2">@{profile.username}</p>
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-col gap-3">
        <Link
          to="/add"
          className="rounded-full bg-accent px-7 py-3.5 text-center text-sm font-medium text-white"
        >
          Add someone
        </Link>
        <Link
          to="/settings"
          className="rounded-full bg-surface-2 px-7 py-3.5 text-center text-sm font-medium text-text-2"
        >
          Settings
        </Link>
      </div>
    </main>
  )
}
