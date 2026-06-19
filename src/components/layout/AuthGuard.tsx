import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth.ts'
import { useProfileReady } from '../../hooks/useProfileReady.ts'
import { queryKeys } from '../../lib/queryKeys.ts'
import { BottomTabBar } from './BottomTabBar.tsx'
import { FullScreenSpinner } from '../Spinner.tsx'

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
    return <FullScreenSpinner />
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }

  if (profileLoading && !hasCachedProfileReady) {
    return <FullScreenSpinner />
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
