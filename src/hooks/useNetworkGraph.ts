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
  loading: boolean
  error: string | null
}

interface NetworkGraphCacheEntry {
  connections: Connection[]
  usersById: Record<string, User>
  bridges: Bridge[]
}

const networkGraphCache = new Map<string, NetworkGraphCacheEntry>()

export function useNetworkGraph(): UseNetworkGraphResult {
  const { user, loading: authLoading } = useAuth()
  const [connections, setConnections] = useState<Connection[]>([])
  const [usersById, setUsersById] = useState<Record<string, User>>({})
  const [bridges, setBridges] = useState<Bridge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!user) {
      setConnections([])
      setUsersById({})
      setBridges([])
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false

    const loadGraphData = async () => {
      // #region agent log
      fetch('http://127.0.0.1:7320/ingest/b9f84f1c-8004-4e98-93fb-d658dbf6a649',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9a13c7'},body:JSON.stringify({sessionId:'9a13c7',runId:'blank-canvas',hypothesisId:'H1',location:'useNetworkGraph.ts:loadGraphData:start',message:'Started network graph data load',data:{userId:user.id,hadCache:Boolean(networkGraphCache.get(user.id))},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const cached = networkGraphCache.get(user.id)
      if (cached) {
        setConnections(cached.connections)
        setUsersById(cached.usersById)
        setBridges(cached.bridges)
        setLoading(false)
      } else {
        setLoading(true)
      }
      setError(null)

      const { data: connectionRows, error: connectionError } = await supabase
        .from('connections')
        .select('*')
        .eq('status', 'active')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)

      if (connectionError) {
        if (!cancelled) {
          setError(connectionError.message)
          setLoading(false)
        }
        return
      }

      const activeConnections = (connectionRows ?? []) as Connection[]
      const networkUserIds = new Set<string>([user.id])
      for (const connection of activeConnections) {
        const otherUserId =
          connection.user_a_id === user.id
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
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)

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
          display_name: id === user.id ? 'You' : 'Unknown',
          username: id === user.id ? 'me' : 'unknown',
          avatar_url: null,
          bio: null,
          created_at: new Date().toISOString(),
        }
      }

      setConnections(activeConnections)
      setUsersById(mappedUsers)
      setBridges((bridgeRows ?? []) as Bridge[])
      // #region agent log
      fetch('http://127.0.0.1:7320/ingest/b9f84f1c-8004-4e98-93fb-d658dbf6a649',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9a13c7'},body:JSON.stringify({sessionId:'9a13c7',runId:'blank-canvas',hypothesisId:'H1',location:'useNetworkGraph.ts:loadGraphData:success',message:'Completed network graph data load',data:{connectionsCount:activeConnections.length,usersCount:userIds.length,bridgesCount:(bridgeRows ?? []).length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      networkGraphCache.set(user.id, {
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
  }, [authLoading, user])

  const nodes = useMemo<NetworkGraphNode[]>(() => {
    if (!user) {
      return []
    }

    const connectionUserIds = new Set<string>()
    for (const connection of connections) {
      connectionUserIds.add(
        connection.user_a_id === user.id ? connection.user_b_id : connection.user_a_id,
      )
    }

    const ids = [user.id, ...Array.from(connectionUserIds)]
    const bridgeCountByUserId: Record<string, number> = {}

    for (const bridge of bridges) {
      const otherUserId =
        bridge.user_a_id === user.id ? bridge.user_b_id : bridge.user_a_id
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
          isSelf: id === user.id,
          bridgeCount: id === user.id ? 0 : (bridgeCountByUserId[id] ?? 0),
        }
      })
      .filter((node): node is NetworkGraphNode => node !== null)
  }, [bridges, connections, user, usersById])

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
    loading: loading || authLoading,
    error,
  }
}
