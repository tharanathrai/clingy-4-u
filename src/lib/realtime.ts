/**
 * Centralised Supabase Realtime helper.
 *
 * All postgres_changes subscriptions must go through subscribePostgresChannel().
 * This guarantees:
 *   1. A unique channel name per effect invocation (crypto.randomUUID suffix),
 *      preventing "cannot add callbacks after subscribe()" when React remounts
 *      the same component (StrictMode double-invoke, navigation back-and-forth).
 *   2. All .on() bindings are registered before .subscribe() is called.
 *   3. Cleanup always calls supabase.removeChannel().
 *
 * ESLint's no-restricted-syntax rule enforces that supabase.channel() is never
 * called directly outside this file.
 */

import { supabase } from './supabase.ts'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export type PostgresEvent = '*' | 'INSERT' | 'UPDATE' | 'DELETE'

export interface ChannelBinding<T extends Record<string, unknown> = Record<string, unknown>> {
  event: PostgresEvent
  table: string
  schema?: string
  filter?: string
  callback: (payload: RealtimePostgresChangesPayload<T>) => void
}

/**
 * Subscribe to one or more postgres_changes events on a channel.
 * Returns the channel (needed only for tests); callers typically only use
 * the returned cleanup function.
 *
 * Usage in a useEffect:
 *   const cleanup = subscribePostgresChannel('gum-pieces', [...bindings])
 *   return cleanup
 */
export function subscribePostgresChannel(
  namePrefix: string,
  bindings: ChannelBinding[],
): () => void {
  const channelName = `${namePrefix}-${crypto.randomUUID()}`
  let channel: RealtimeChannel = supabase.channel(channelName)

  for (const binding of bindings) {
    channel = channel.on(
      'postgres_changes',
      {
        event: binding.event,
        schema: binding.schema ?? 'public',
        table: binding.table,
        ...(binding.filter ? { filter: binding.filter } : {}),
      },
      binding.callback as (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
    )
  }

  channel.subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
