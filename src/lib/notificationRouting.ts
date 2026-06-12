import type { NotificationType } from '../hooks/useNotifications.ts'

export interface StaleGumPieceTapResult {
  dismiss: true
  toast: string
}

export interface ContinueGumPieceTapResult {
  dismiss: false
}

export type GumPieceTapResult = StaleGumPieceTapResult | ContinueGumPieceTapResult

const GUM_PIECE_ROUTE_TYPES: NotificationType[] = [
  'invite_received',
  'invite_accepted',
  'invite_rejected',
  'plan_turned_down',
  'plan_expiring_soon',
]

const STALE_GUM_PIECE_CHECK_TYPES: NotificationType[] = ['invite_received', 'plan_expiring_soon']

export function routesToGumPiece(type: string): type is NotificationType {
  return (GUM_PIECE_ROUTE_TYPES as string[]).includes(type)
}

export function shouldCheckGumPieceStatus(type: string): type is NotificationType {
  return (STALE_GUM_PIECE_CHECK_TYPES as string[]).includes(type)
}

export function resolveStaleGumPieceTap(
  type: NotificationType,
  pieceStatus: string | null | undefined,
): GumPieceTapResult {
  if (pieceStatus !== 'expired') {
    return { dismiss: false }
  }

  if (type === 'invite_received') {
    return { dismiss: true, toast: 'This invite has expired.' }
  }

  if (type === 'plan_expiring_soon') {
    return { dismiss: true, toast: 'This plan has already expired.' }
  }

  return { dismiss: false }
}
