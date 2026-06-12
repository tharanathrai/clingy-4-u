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
  'plan_expired',
]

const TERMINAL_GUM_PIECE_STATUSES = new Set(['confirmed', 'turned_down', 'expired'])

export function routesToGumPiece(type: string): type is NotificationType {
  return (GUM_PIECE_ROUTE_TYPES as string[]).includes(type)
}

export function shouldCheckGumPieceStatus(type: string): type is NotificationType {
  return routesToGumPiece(type)
}

function isTerminalGumPieceStatus(status: string | null | undefined): boolean {
  return status != null && TERMINAL_GUM_PIECE_STATUSES.has(status)
}

export function resolveStaleGumPieceTap(
  type: NotificationType,
  pieceStatus: string | null | undefined,
): GumPieceTapResult {
  if (!isTerminalGumPieceStatus(pieceStatus)) {
    return { dismiss: false }
  }

  if (type === 'invite_received') {
    return { dismiss: true, toast: 'This invite has expired.' }
  }

  if (type === 'plan_expiring_soon' || type === 'plan_expired') {
    return { dismiss: true, toast: 'This plan has already expired.' }
  }

  if (type === 'invite_accepted') {
    if (pieceStatus === 'confirmed') {
      return { dismiss: true, toast: 'This plan is already confirmed.' }
    }
    if (pieceStatus === 'turned_down') {
      return { dismiss: true, toast: 'This plan was turned down.' }
    }
    return { dismiss: true, toast: 'This plan has expired.' }
  }

  if (type === 'plan_turned_down' || type === 'invite_rejected') {
    if (pieceStatus === 'confirmed') {
      return { dismiss: true, toast: 'This plan is already confirmed.' }
    }
    if (pieceStatus === 'turned_down') {
      return { dismiss: true, toast: 'This plan was turned down.' }
    }
    return { dismiss: true, toast: 'This plan has expired.' }
  }

  return { dismiss: false }
}
