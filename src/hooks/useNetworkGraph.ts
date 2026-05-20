import { useEffect, useMemo, useState } from 'react'
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

interface NetworkGraphCacheEntry {
  connections: Connection[]
  usersById: Record<string, User>
  bridges: Bridge[]
}

const networkGraphCache = new Map<string, NetworkGraphCacheEntry>()

export function useNetworkGraph(): UseNetworkGraphResult {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [connections, setConnections] = useState<Connection[]>([])
  const [usersById, setUsersById] = useState<Record<string, User>>({})
  const [bridges, setBridges] = useState<Bridge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!userId) {
      setConnections([])
      setUsersById({})
      setBridges([])
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false

    const loadGraphData = async () => {
      const cached = networkGraphCache.get(userId)
      if (cached) {
        setConnections(cached.connections)
        setUsersById(cached.usersById)
        setBridges(cached.bridges)
        setLoading(false)
        setError(null)
        return
      }

      setLoading(true)
      setError(null)

      const { data: connectionRows, error: connectionError } = await supabase
        .from('connections')
        .select('*')
        .eq('status', 'active')
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)

      if (connectionError) {
        if (!cancelled) {
          setError(connectionError.message)
          setLoading(false)
        }
        return
      }

      const activeConnections = (connectionRows ?? []) as Connection[]
      const networkUserIds = new Set<string>([userId])
      for (const connection of activeConnections) {
        const otherUserId =
          connection.user_a_id === userId
            ? connection.user_b_id
            : connection.user_a_id
        networkUserIds.add(otherUserId)
      }

      const userIds = Array.from(networkUserIds)
      const { data: userRows, error: usersError } = await supabase
        .from('users')
        .select('*')
        .in('id', userIds)

      if (usersError) {
        if (!cancelled) {
          setError(usersError.message)
          setLoading(false)
        }
        return
      }

      const { data: bridgeRows, error: bridgesError } = await supabase
        .from('bridges')
        .select('*')
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)

      if (bridgesError) {
        if (!cancelled) {
          setError(bridgesError.message)
          setLoading(false)
        }
        return
      }

      if (cancelled) {
        return
      }

      const mappedUsers = ((userRows ?? []) as User[]).reduce<
        Record<string, User>
      >((accumulator, profile) => {
        accumulator[profile.id] = profile
        return accumulator
      }, {})

      // Keep graph usable even when profile rows are missing for some ids.
      for (const id of userIds) {
        if (mappedUsers[id]) {
          continue
        }

        mappedUsers[id] = {
          id,
          display_name: id === userId ? 'You' : 'Unknown',
          username: id === userId ? 'me' : 'unknown',
          avatar_url: null,
          bio: null,
          created_at: new Date().toISOString(),
        }
      }

      setConnections(activeConnections)
      setUsersById(mappedUsers)
      setBridges((bridgeRows ?? []) as Bridge[])
      networkGraphCache.set(userId, {
        connections: activeConnections,
        usersById: mappedUsers,
        bridges: (bridgeRows ?? []) as Bridge[],
      })
      setLoading(false)
    }

    void loadGraphData()

    return () => {
      cancelled = true
    }
  }, [authLoading, refreshIndex, userId])

  const nodes = useMemo<NetworkGraphNode[]>(() => {
    if (!userId) {
      return []
    }

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
        if (!profile) {
          return null
        }

        return {
          id,
          user: profile,
          isSelf: id === userId,
          bridgeCount: id === userId ? 0 : (bridgeCountByUserId[id] ?? 0),
        }
      })
      .filter((node): node is NetworkGraphNode => node !== null)
  }, [bridges, connections, userId, usersById])

  const edges = useMemo<NetworkGraphEdge[]>(() => {
    return bridges.map((bridge) => ({
      id: bridge.id,
      source: bridge.user_a_id,
      target: bridge.user_b_id,
      bridge,
    }))
  }, [bridges])

  return {
    nodes,
    edges,
    usersById,
    loading: loading || authLoading,
    error,
    refetch: () => {
      if (userId) {
        networkGraphCache.delete(userId)
      }
      setRefreshIndex((current) => current + 1)
    },
  }
}
