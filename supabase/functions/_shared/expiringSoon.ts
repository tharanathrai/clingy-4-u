export const EXPIRING_SOON_WINDOW_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

export function getExpiringSoonWindow(now: Date): {
  windowStartIso: string
  windowEndIso: string
} {
  const windowStartIso = now.toISOString()
  const windowEndIso = new Date(
    now.getTime() + EXPIRING_SOON_WINDOW_DAYS * MS_PER_DAY,
  ).toISOString()
  return { windowStartIso, windowEndIso }
}

export function isActivePieceExpiringSoon(
  expiresAtIso: string,
  now: Date,
  windowDays = EXPIRING_SOON_WINDOW_DAYS,
): boolean {
  const expiresAtMs = new Date(expiresAtIso).getTime()
  const nowMs = now.getTime()
  const windowEndMs = nowMs + windowDays * MS_PER_DAY
  return expiresAtMs > nowMs && expiresAtMs <= windowEndMs
}

export interface PieceForExpiringSoon {
  id: string
  member_ids: string[]
}

export interface ExistingExpiringNotification {
  user_id: string
  reference_id: string
  type: string
}

export interface ExpiringSoonNotificationRow {
  user_id: string
  type: 'plan_expiring_soon'
  reference_id: string
  read: false
}

export function buildExpiringSoonNotificationRows(
  pieces: PieceForExpiringSoon[],
  existingNotifications: ExistingExpiringNotification[],
): ExpiringSoonNotificationRow[] {
  const existingKeys = new Set(
    existingNotifications
      .filter((notification) => notification.type === 'plan_expiring_soon')
      .map((notification) => `${notification.user_id}:${notification.reference_id}`),
  )

  const rows: ExpiringSoonNotificationRow[] = []

  for (const piece of pieces) {
    for (const userId of piece.member_ids) {
      const key = `${userId}:${piece.id}`
      if (existingKeys.has(key)) {
        continue
      }
      rows.push({
        user_id: userId,
        type: 'plan_expiring_soon',
        reference_id: piece.id,
        read: false,
      })
      existingKeys.add(key)
    }
  }

  return rows
}

export function usersNeedingExpiringSoonEmail(
  notificationRows: ExpiringSoonNotificationRow[],
): Map<string, Set<string>> {
  const byPiece = new Map<string, Set<string>>()
  for (const row of notificationRows) {
    const users = byPiece.get(row.reference_id) ?? new Set<string>()
    users.add(row.user_id)
    byPiece.set(row.reference_id, users)
  }
  return byPiece
}
