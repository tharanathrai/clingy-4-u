import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth.ts'
import { useProfileReady } from '../../hooks/useProfileReady.ts'
import { postAuthReturnToKey } from '../../lib/recoveryPath.ts'
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
    // Onboarding just finished. If the user arrived via a scanned connect link, resume that
    // flow so the request auto-sends; otherwise land on Add. Must match Welcome's own
    // post-onboarding navigate — both can fire in the same render, so they have to agree.
    const returnTo = sessionStorage.getItem(postAuthReturnToKey)
    if (returnTo && /^\/connect(\?|$)/.test(returnTo)) {
      return <Navigate to={returnTo} replace />
    }
    return <Navigate to="/add" replace state={{ fromOnboarding: true }} />
  }

  const showBottomTabBar = profileReady && location.pathname !== '/welcome'

  return (
    <>
      {children}
      {showBottomTabBar ? <BottomTabBar /> : null}
    </>
  )
}
