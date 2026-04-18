import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
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
  } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!session?.access_token) {
      authStore.initialized = true
      setAuthState({ user: null, loading: false })
      return
    }

    void syncUser()
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
  }, [])

  return {
    user,
    loading,
    signInWithGoogle,
    signOut,
  }
}
