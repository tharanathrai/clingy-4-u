import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth.ts'
import { useProfileReady } from '../../hooks/useProfileReady.ts'
import { queryKeys } from '../../lib/queryKeys.ts'
import { BottomTabBar } from './BottomTabBar.tsx'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { profileReady, isLoading: profileLoading } = useProfileReady(user?.id ?? null)

  const hasCachedProfileReady =
    user?.id !== undefined &&
    queryClient.getQueryData(queryKeys.profileReady(user.id)) !== undefined

  if (loading && !user) {
    return (
      <main className="safe-screen-height flex items-center justify-center bg-bg px-5 text-text">
        <p className="text-sm text-text-2">Checking your session...</p>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }

  if (profileLoading && !hasCachedProfileReady) {
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
