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

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const syncUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) {
        if (mounted) {
          setUser(null)
          setLoading(false)
        }
        return
      }

      if (mounted) {
        setUser(data.user)
        setLoading(false)
      }
    }

    void syncUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
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
