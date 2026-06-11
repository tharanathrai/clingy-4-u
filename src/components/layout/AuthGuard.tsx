import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.ts'
import { useProfileReady } from '../../hooks/useProfileReady.ts'
import { BottomTabBar } from './BottomTabBar.tsx'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const { profileReady, isLoading: profileLoading } = useProfileReady(user?.id ?? null)

  if (loading) {
    return (
      <main className="safe-screen-height flex items-center justify-center bg-bg px-5 text-text">
        <p className="text-sm text-text-2">Checking your session...</p>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }

  if (profileLoading || profileReady === null) {
    return (
      <main className="safe-screen-height flex items-center justify-center bg-bg px-5 text-text">
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
