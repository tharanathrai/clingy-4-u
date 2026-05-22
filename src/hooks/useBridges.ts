import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth.ts'
import { supabase } from '../lib/supabase.ts'

export interface Bridge {
  id: string
  gum_piece_id: string
  user_a_id: string
  user_b_id: string
  category: string
  color_hex: string
  activity_title: string
  formed_at: string
}

interface UseBridgesParams {
  otherUserId?: string
}

interface UseBridgesResult {
  bridges: Bridge[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

async function fetchBridges(userId: string, otherUserId?: string): Promise<Bridge[]> {
  let query = supabase
    .from('bridges')
    .select('*')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .order('formed_at', { ascending: false })

  if (otherUserId) {
    query = query.or(
      `and(user_a_id.eq.${userId},user_b_id.eq.${otherUserId}),and(user_a_id.eq.${otherUserId},user_b_id.eq.${userId})`,
    )
  }

  const { data, error: queryError } = await query
  if (queryError) {
    throw new Error(queryError.message)
  }

  return (data ?? []) as Bridge[]
}

export function useBridges({ otherUserId }: UseBridgesParams = {}): UseBridgesResult {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['bridges', userId, otherUserId ?? null],
    queryFn: () => fetchBridges(userId!, otherUserId),
    enabled: !authLoading && userId !== null,
    staleTime: Infinity,
  })

  return {
    bridges: data ?? [],
    loading: authLoading || isLoading,
    error: error instanceof Error ? error.message : null,
    refetch: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bridges', userId] })
    },
  }
}
