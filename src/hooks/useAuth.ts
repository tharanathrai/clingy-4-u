import { useCallback, useEffect, useState } from 'react'
import type { AuthChangeEvent, User } from '@supabase/supabase-js'
import { queryClient } from '../lib/queryClient.ts'
import { supabase } from '../lib/supabase.ts'

interface UseAuthResult {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const getAuthRedirectUrl = (): string => {
  return `${window.location.origin}/auth/callback`
}

type AuthListener = (next: { user: User | null; loading: boolean }) => void

const authStore = {
  user: null as User | null,
  loading: true,
  initialized: false,
  listeners: new Set<AuthListener>(),
  unsubscribe: null as (() => void) | null,
}

const notifyAuthListeners = () => {
  for (const listener of authStore.listeners) {
    listener({
      user: authStore.user,
      loading: authStore.loading,
    })
  }
}

const setAuthState = (next: { user: User | null; loading: boolean }) => {
  authStore.user = next.user
  authStore.loading = next.loading
  notifyAuthListeners()
}

const clearUserQueryCache = () => {
  queryClient.clear()
}

const isSameUserSession = (nextUser: User | null): boolean => {
  return Boolean(nextUser && authStore.user?.id === nextUser.id)
}

const handleAuthChange = (event: AuthChangeEvent, session: { user: User } | null) => {
  if (event === 'SIGNED_OUT' || !session?.user) {
    authStore.initialized = true
    clearUserQueryCache()
    setAuthState({ user: null, loading: false })
    return
  }

  const nextUser = session.user

  if (isSameUserSession(nextUser) && authStore.initialized) {
    authStore.user = nextUser
    notifyAuthListeners()
    return
  }

  if (event === 'SIGNED_IN' && authStore.user && authStore.user.id !== nextUser.id) {
    clearUserQueryCache()
  }

  authStore.initialized = true
  setAuthState({ user: nextUser, loading: false })
}

const ensureAuthSubscription = () => {
  if (authStore.unsubscribe) {
    return
  }

  const syncUser = async () => {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      authStore.initialized = true
      setAuthState({ user: null, loading: false })
      return
    }

    authStore.initialized = true
    setAuthState({ user: data.user, loading: false })
  }

  void syncUser()

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    handleAuthChange(event, session)
  })

  authStore.unsubscribe = () => {
    subscription.unsubscribe()
    authStore.unsubscribe = null
  }
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(authStore.user)
  const [loading, setLoading] = useState<boolean>(
    authStore.initialized ? authStore.loading : true,
  )

  useEffect(() => {
    ensureAuthSubscription()

    const listener: AuthListener = ({ user: nextUser, loading: nextLoading }) => {
      setUser(nextUser)
      setLoading(nextLoading)
    }
    authStore.listeners.add(listener)

    if (authStore.initialized) {
      setUser(authStore.user)
      setLoading(authStore.loading)
    }

    return () => {
      authStore.listeners.delete(listener)
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthRedirectUrl(),
      },
    })

    if (error) {
      throw error
    }
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      throw error
    }

    clearUserQueryCache()
  }, [])

  return {
    user,
    loading,
    signInWithGoogle,
    signOut,
  }
}
