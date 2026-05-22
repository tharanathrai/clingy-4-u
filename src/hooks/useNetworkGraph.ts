import { useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase.ts'
import type { Bridge, Connection, User } from '../types/index.ts'
import { useAuth } from './useAuth.ts'

export interface NetworkGraphNode {
  id: string
  user: User
  isSelf: boolean
  bridgeCount: number
}

export interface NetworkGraphEdge {
  id: string
  source: string
  target: string
  bridge: Bridge
}

interface UseNetworkGraphResult {
  nodes: NetworkGraphNode[]
  edges: NetworkGraphEdge[]
  usersById: Record<string, User>
  loading: boolean
  error: string | null
  refetch: () => void
}

interface NetworkGraphData {
  connections: Connection[]
  usersById: Record<string, User>
  bridges: Bridge[]
}

async function fetchNetworkGraph(userId: string): Promise<NetworkGraphData> {
  const { data: connectionRows, error: connectionError } = await supabase
    .from('connections')
    .select('*')
    .eq('status', 'active')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)

  if (connectionError) {
    throw new Error(connectionError.message)
  }

  const activeConnections = (connectionRows ?? []) as Connection[]
  const networkUserIds = new Set<string>([userId])
  for (const connection of activeConnections) {
    const otherUserId =
      connection.user_a_id === userId ? connection.user_b_id : connection.user_a_id
    networkUserIds.add(otherUserId)
  }

  const userIds = Array.from(networkUserIds)
  const { data: userRows, error: usersError } = await supabase
    .from('users')
    .select('*')
    .in('id', userIds)

  if (usersError) {
    throw new Error(usersError.message)
  }

  const { data: bridgeRows, error: bridgesError } = await supabase
    .from('bridges')
    .select('*')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)

  if (bridgesError) {
    throw new Error(bridgesError.message)
  }

  const mappedUsers = ((userRows ?? []) as User[]).reduce<Record<string, User>>(
    (acc, profile) => {
      acc[profile.id] = profile
      return acc
    },
    {},
  )

  // Keep graph usable even when profile rows are missing for some ids.
  for (const id of userIds) {
    if (mappedUsers[id]) continue
    mappedUsers[id] = {
      id,
      display_name: id === userId ? 'You' : 'Unknown',
      username: id === userId ? 'me' : 'unknown',
      avatar_url: null,
      bio: null,
      created_at: new Date().toISOString(),
    }
  }

  return {
    connections: activeConnections,
    usersById: mappedUsers,
    bridges: (bridgeRows ?? []) as Bridge[],
  }
}

export function useNetworkGraph(): UseNetworkGraphResult {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['network-graph', userId],
    queryFn: () => fetchNetworkGraph(userId!),
    enabled: !authLoading && userId !== null,
    staleTime: Infinity,
  })

  // Real-time: connections and bridges changes → invalidate
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`network-graph-rt-${userId}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connections' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['network-graph', userId] })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bridges' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['network-graph', userId] })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient, userId])

  const connections = data?.connections ?? []
  const usersById = data?.usersById ?? {}
  const bridges = data?.bridges ?? []

  const nodes = useMemo<NetworkGraphNode[]>(() => {
    if (!userId) return []

    const connectionUserIds = new Set<string>()
    for (const connection of connections) {
      connectionUserIds.add(
        connection.user_a_id === userId ? connection.user_b_id : connection.user_a_id,
      )
    }

    const ids = [userId, ...Array.from(connectionUserIds)]
    const bridgeCountByUserId: Record<string, number> = {}

    for (const bridge of bridges) {
      const otherUserId =
        bridge.user_a_id === userId ? bridge.user_b_id : bridge.user_a_id
      bridgeCountByUserId[otherUserId] = (bridgeCountByUserId[otherUserId] ?? 0) + 1
    }

    return ids
      .map((id) => {
        const profile = usersById[id]
        if (!profile) return null
        return {
          id,
          user: profile,
          isSelf: id === userId,
          bridgeCount: id === userId ? 0 : (bridgeCountByUserId[id] ?? 0),
        }
      })
      .filter((node): node is NetworkGraphNode => node !== null)
  }, [bridges, connections, userId, usersById])

  const edges = useMemo<NetworkGraphEdge[]>(
    () =>
      bridges.map((bridge) => ({
        id: bridge.id,
        source: bridge.user_a_id,
        target: bridge.user_b_id,
        bridge,
      })),
    [bridges],
  )

  return {
    nodes,
    edges,
    usersById,
    loading: authLoading || isLoading,
    error: error instanceof Error ? error.message : null,
    refetch: () => {
      void queryClient.invalidateQueries({ queryKey: ['network-graph', userId] })
    },
  }
}

export function invalidateNetworkGraphCache(
  userId: string | null | undefined,
  queryClient?: ReturnType<typeof useQueryClient>,
): void {
  if (!userId || !queryClient) return
  void queryClient.invalidateQueries({ queryKey: ['network-graph', userId] })
}
