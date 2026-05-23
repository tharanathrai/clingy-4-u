import { type ReactNode, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.ts'
import { supabase } from '../../lib/supabase.ts'
import { BottomTabBar } from './BottomTabBar.tsx'

interface AuthGuardProps {
  children: ReactNode
}

const profileReadyCache = new Map<string, boolean>()

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [profileReady, setProfileReady] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!user) {
      setProfileReady(null)
      return () => {
        cancelled = true
      }
    }

    const cachedProfileReady = profileReadyCache.get(user.id)
    const shouldRecheckProfile =
      cachedProfileReady !== true || location.pathname === '/welcome'

    if (cachedProfileReady !== undefined) {
      setProfileReady(cachedProfileReady)
      if (!shouldRecheckProfile) {
        return () => {
          cancelled = true
        }
      }
    }

    if (cachedProfileReady === undefined) {
      setProfileReady(null)
    }

    const checkProfile = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (cancelled) {
        return
      }

      if (error) {
        profileReadyCache.set(user.id, false)
        setProfileReady(false)
        return
      }

      const ready = Boolean(data)
      profileReadyCache.set(user.id, ready)
      setProfileReady(ready)
    }

    void checkProfile()

    return () => {
      cancelled = true
    }
  }, [location.pathname, user])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-5 text-text">
        <p className="text-sm text-text-2">Checking your session...</p>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }

  if (profileReady === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-5 text-text">
        <p className="text-sm text-text-2">Loading your account...</p>
      </main>
    )
  }

  if (!profileReady && location.pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />
  }

  if (profileReady && location.pathname === '/welcome') {
    return <Navigate to="/add" replace />
  }

  const showBottomTabBar = profileReady && location.pathname !== '/welcome'

  return (
    <>
      {children}
      {showBottomTabBar ? <BottomTabBar /> : null}
    </>
  )
}
