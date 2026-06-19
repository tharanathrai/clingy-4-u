import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CATEGORIES, type CategorySlug } from '../lib/constants.ts'
import { queryKeys } from '../lib/queryKeys.ts'
import { isInitialQueryLoading } from '../lib/queryLoading.ts'
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
  isSnoozed: boolean
  loading: boolean
  error: string | null
  refetch: () => void
}

interface ProfileData {
  profile: User
  bridgeCount: number
  connectionCount: number
  categoryBreakdown: Record<CategorySlug, number>
  sharedBridges: Bridge[]
  isConnected: boolean
  isSnoozed: boolean
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

async function fetchProfile(
  identifier: string,
  byUserId: boolean,
  viewerId: string | null,
): Promise<ProfileData> {
  let profileQuery = supabase.from('users').select('*')
  if (byUserId) {
    profileQuery = profileQuery.eq('id', identifier)
  } else {
    profileQuery = profileQuery.eq('username', identifier.trim().toLowerCase())
  }

  const { data: profileData, error: profileError } = await profileQuery.maybeSingle()

  if (profileError) {
    throw new Error(profileError.message)
  }

  if (!profileData) {
    throw new Error('Profile not found.')
  }

  const resolvedProfile = profileData as User

  const { data: bridgesData, error: bridgesError } = await supabase
    .from('bridges')
    .select('*')
    .or(`user_a_id.eq.${resolvedProfile.id},user_b_id.eq.${resolvedProfile.id}`)
    .order('formed_at', { ascending: false })

  if (bridgesError) {
    throw new Error(bridgesError.message)
  }

  const profileBridges = (bridgesData ?? []) as Bridge[]
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

  if (!viewerId || viewerId === resolvedProfile.id) {
    return {
      profile: resolvedProfile,
      bridgeCount: profileBridges.length,
      connectionCount: uniquePartners.size,
      categoryBreakdown: breakdown,
      sharedBridges: [],
      isConnected: viewerId === resolvedProfile.id,
      isSnoozed: false,
    }
  }

  const { data: connectionData, error: connectionError } = await supabase
    .from('connections')
    .select('id, user_a_id, snoozed_by_a, snoozed_by_b')
    .eq('status', 'active')
    .or(
      `and(user_a_id.eq.${viewerId},user_b_id.eq.${resolvedProfile.id}),and(user_a_id.eq.${resolvedProfile.id},user_b_id.eq.${viewerId})`,
    )
    .maybeSingle()

  if (connectionError) {
    throw new Error(connectionError.message)
  }

  const connected = Boolean(connectionData)

  if (!connected) {
    return {
      profile: resolvedProfile,
      bridgeCount: profileBridges.length,
      connectionCount: uniquePartners.size,
      categoryBreakdown: breakdown,
      sharedBridges: [],
      isConnected: false,
      isSnoozed: false,
    }
  }

  const isSnoozed = connectionData.user_a_id === viewerId
    ? connectionData.snoozed_by_a
    : connectionData.snoozed_by_b

  const { data: sharedBridgesData, error: sharedBridgesError } = await supabase
    .from('bridges')
    .select('*')
    .or(
      `and(user_a_id.eq.${viewerId},user_b_id.eq.${resolvedProfile.id}),and(user_a_id.eq.${resolvedProfile.id},user_b_id.eq.${viewerId})`,
    )
    .order('formed_at', { ascending: false })

  if (sharedBridgesError) {
    throw new Error(sharedBridgesError.message)
  }

  return {
    profile: resolvedProfile,
    bridgeCount: profileBridges.length,
    connectionCount: uniquePartners.size,
    categoryBreakdown: breakdown,
    sharedBridges: (sharedBridgesData ?? []) as Bridge[],
    isConnected: true,
    isSnoozed,
  }
}

export function useProfile({
  username,
  userId,
}: UseProfileParams): UseProfileResult {
  const { user: viewer, loading: authLoading } = useAuth()
  const viewerId = viewer?.id ?? null
  const queryClient = useQueryClient()

  const normalizedUsername = username?.trim().toLowerCase() ?? ''
  const normalizedUserId = userId?.trim() ?? ''

  const identifier = normalizedUserId || normalizedUsername || viewerId || ''
  const byUserId = Boolean(normalizedUserId || (!normalizedUsername && viewerId))

  const queryKey = useMemo(
    () => queryKeys.profile(identifier, byUserId, viewerId),
    [byUserId, identifier, viewerId],
  )

  const { data, isPending, error } = useQuery({
    queryKey,
    queryFn: () => fetchProfile(identifier, byUserId, viewerId),
    enabled: !authLoading && Boolean(identifier),
    staleTime: Infinity,
  })

  return {
    profile: data?.profile ?? null,
    bridgeCount: data?.bridgeCount ?? 0,
    connectionCount: data?.connectionCount ?? 0,
    categoryBreakdown: data?.categoryBreakdown ?? createEmptyCategoryBreakdown(),
    sharedBridges: data?.sharedBridges ?? [],
    isConnected: data?.isConnected ?? false,
    isSnoozed: data?.isSnoozed ?? false,
    loading: isInitialQueryLoading(authLoading, viewerId, isPending),
    error: error instanceof Error ? error.message : null,
    refetch: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  }
}
