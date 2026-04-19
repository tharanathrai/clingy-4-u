import { useCallback, useEffect, useMemo, useState } from 'react'
import { CATEGORIES, type CategorySlug } from '../lib/constants.ts'
import { supabase } from '../lib/supabase.ts'
import type { Bridge, User } from '../types/index.ts'
import { useAuth } from './useAuth.ts'

interface UseProfileParams {
  username?: string
  userId?: string
}

interface UseProfileResult {
  profile: User | null
  bridgeCount: number
  connectionCount: number
  categoryBreakdown: Record<CategorySlug, number>
  sharedBridges: Bridge[]
  isConnected: boolean
  loading: boolean
  error: string | null
  refetch: () => void
}

const createEmptyCategoryBreakdown = (): Record<CategorySlug, number> => ({
  intimate: 0,
  active: 0,
  playful: 0,
  explore: 0,
  recharge: 0,
  savor: 0,
  support: 0,
})

const isCategorySlug = (value: string): value is CategorySlug => value in CATEGORIES

export function useProfile({
  username,
  userId,
}: UseProfileParams): UseProfileResult {
  const { user: viewer, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<User | null>(null)
  const [bridgeCount, setBridgeCount] = useState(0)
  const [connectionCount, setConnectionCount] = useState(0)
  const [categoryBreakdown, setCategoryBreakdown] = useState<Record<CategorySlug, number>>(
    createEmptyCategoryBreakdown(),
  )
  const [sharedBridges, setSharedBridges] = useState<Bridge[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)

  const normalizedUsername = useMemo(() => username?.trim().toLowerCase() ?? '', [username])
  const normalizedUserId = useMemo(() => userId?.trim() ?? '', [userId])

  useEffect(() => {
    if (authLoading) {
      return
    }

    let cancelled = false

    const loadProfile = async () => {
      setLoading(true)
      setError(null)

      const fallbackProfileId = !normalizedUsername ? viewer?.id ?? '' : ''
      const profileIdOrUsername = normalizedUserId || normalizedUsername || fallbackProfileId
      if (!profileIdOrUsername) {
        if (!cancelled) {
          setProfile(null)
          setBridgeCount(0)
          setConnectionCount(0)
          setCategoryBreakdown(createEmptyCategoryBreakdown())
          setSharedBridges([])
          setIsConnected(false)
          setError('Profile not found.')
          setLoading(false)
        }
        return
      }

      let profileQuery = supabase.from('users').select('*')
      if (normalizedUserId || fallbackProfileId) {
        profileQuery = profileQuery.eq('id', normalizedUserId || fallbackProfileId)
      } else {
        profileQuery = profileQuery.eq('username', normalizedUsername)
      }

      const { data: profileData, error: profileError } = await profileQuery.maybeSingle()

      if (cancelled) {
        return
      }

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }

      if (!profileData) {
        setError('Profile not found.')
        setLoading(false)
        return
      }

      const resolvedProfile = profileData as User
      setProfile(resolvedProfile)

      const { data: bridgesData, error: bridgesError } = await supabase
        .from('bridges')
        .select('*')
        .or(`user_a_id.eq.${resolvedProfile.id},user_b_id.eq.${resolvedProfile.id}`)
        .order('formed_at', { ascending: false })

      if (cancelled) {
        return
      }

      if (bridgesError) {
        setError(bridgesError.message)
        setLoading(false)
        return
      }

      const profileBridges = (bridgesData ?? []) as Bridge[]
      setBridgeCount(profileBridges.length)

      const uniquePartners = new Set<string>()
      const breakdown = createEmptyCategoryBreakdown()

      for (const bridge of profileBridges) {
        const partnerId =
          bridge.user_a_id === resolvedProfile.id ? bridge.user_b_id : bridge.user_a_id
        uniquePartners.add(partnerId)

        if (isCategorySlug(bridge.category)) {
          breakdown[bridge.category] += 1
        }
      }

      setConnectionCount(uniquePartners.size)
      setCategoryBreakdown(breakdown)

      if (!viewer || viewer.id === resolvedProfile.id) {
        setIsConnected(viewer?.id === resolvedProfile.id)
        setLoading(false)
        return
      }

      const { data: connectionData, error: connectionError } = await supabase
        .from('connections')
        .select('id')
        .eq('status', 'active')
        .or(
          `and(user_a_id.eq.${viewer.id},user_b_id.eq.${resolvedProfile.id}),and(user_a_id.eq.${resolvedProfile.id},user_b_id.eq.${viewer.id})`,
        )
        .maybeSingle()

      if (cancelled) {
        return
      }

      if (connectionError) {
        setError(connectionError.message)
        setLoading(false)
        return
      }

      const connected = Boolean(connectionData)
      setIsConnected(connected)

      if (!connected) {
        setLoading(false)
        return
      }

      const { data: sharedBridgesData, error: sharedBridgesError } = await supabase
        .from('bridges')
        .select('*')
        .or(
          `and(user_a_id.eq.${viewer.id},user_b_id.eq.${resolvedProfile.id}),and(user_a_id.eq.${resolvedProfile.id},user_b_id.eq.${viewer.id})`,
        )
        .order('formed_at', { ascending: false })

      if (cancelled) {
        return
      }

      if (sharedBridgesError) {
        setError(sharedBridgesError.message)
        setLoading(false)
        return
      }

      setSharedBridges((sharedBridgesData ?? []) as Bridge[])
      setLoading(false)
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [authLoading, normalizedUserId, normalizedUsername, refreshIndex, viewer])

  const refetch = useCallback(() => {
    setRefreshIndex((previous) => previous + 1)
  }, [])

  return {
    profile,
    bridgeCount,
    connectionCount,
    categoryBreakdown,
    sharedBridges,
    isConnected,
    loading: loading || authLoading,
    error,
    refetch,
  }
}
