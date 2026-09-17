import { getNotificationCopy } from './notificationCopy.ts'

// Shape of the JSON string sent as the push message body. The service worker
// (src/sw.ts) parses this and calls showNotification.
export interface PushPayload {
  title: string
  body: string
  url: string
  tag: string
}

export interface PushNotificationRow {
  id: string
  type: string
  reference_id: string
  actor_name?: string | null
}

export const PUSH_TITLE = 'Clingy'
export const PUSH_URL = '/notifications'

// Web Push `Topic` header: at most 32 URL-safe base64 characters. Same value
// is used as the browser notification `tag` so a repeat for the same piece
// replaces rather than stacks.
const TOPIC_MAX_LENGTH = 32

export function buildPushTag(type: string, referenceId: string): string {
  const raw = `${type}-${referenceId}`.replace(/[^A-Za-z0-9_-]/g, '')
  return raw.slice(0, TOPIC_MAX_LENGTH)
}

export function buildPushPayload(row: PushNotificationRow): PushPayload {
  return {
    title: PUSH_TITLE,
    body: getNotificationCopy(row.type, row.actor_name ?? 'Someone'),
    url: PUSH_URL,
    tag: buildPushTag(row.type, row.reference_id),
  }
}
