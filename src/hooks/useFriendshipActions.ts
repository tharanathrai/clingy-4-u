import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.ts'
import { useAuth } from './useAuth.ts'
import { queryKeys } from '../lib/queryKeys.ts'

interface UseFriendshipActionsResult {
  snooze: (otherUserId: string, otherUsername: string) => Promise<void>
  unsnooze: (otherUserId: string, otherUsername: string) => Promise<void>
  remove: (otherUserId: string, otherUsername: string) => Promise<void>
  loading: boolean
  error: string | null
}

export function useFriendshipActions(): UseFriendshipActionsResult {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const invalidateProfile = (otherUsername: string) => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.profile(otherUsername, false, user?.id ?? null),
    })
  }

  const invalidateFeed = () => {
    if (user?.id) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed(user.id) })
    }
  }

  const invalidateNetwork = () => {
    if (user?.id) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.networkGraph(user.id) })
    }
  }

  const snooze = async (otherUserId: string, otherUsername: string) => {
    setLoading(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('snooze_friend', {
        other_user_id: otherUserId,
      })
      if (rpcError) throw new Error(rpcError.message)
      invalidateProfile(otherUsername)
      invalidateFeed()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to snooze')
    } finally {
      setLoading(false)
    }
  }

  const unsnooze = async (otherUserId: string, otherUsername: string) => {
    setLoading(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('unsnooze_friend', {
        other_user_id: otherUserId,
      })
      if (rpcError) throw new Error(rpcError.message)
      invalidateProfile(otherUsername)
      invalidateFeed()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unsnooze')
    } finally {
      setLoading(false)
    }
  }

  const remove = async (otherUserId: string, otherUsername: string) => {
    setLoading(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('remove_friend', {
        other_user_id: otherUserId,
      })
      if (rpcError) throw new Error(rpcError.message)
      invalidateProfile(otherUsername)
      invalidateFeed()
      invalidateNetwork()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove friend')
    } finally {
      setLoading(false)
    }
  }

  return { snooze, unsnooze, remove, loading, error }
}
