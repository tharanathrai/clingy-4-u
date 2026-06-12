import { describe, expect, it } from 'vitest'
import {
  resolveStaleGumPieceTap,
  routesToGumPiece,
  shouldCheckGumPieceStatus,
} from '../lib/notificationRouting.ts'

describe('notificationRouting', () => {
  describe('routesToGumPiece', () => {
    it('includes plan_expiring_soon and invite types', () => {
      expect(routesToGumPiece('plan_expiring_soon')).toBe(true)
      expect(routesToGumPiece('invite_received')).toBe(true)
      expect(routesToGumPiece('bridge_formed')).toBe(false)
    })
  })

  describe('shouldCheckGumPieceStatus', () => {
    it('checks invite_received and plan_expiring_soon only', () => {
      expect(shouldCheckGumPieceStatus('invite_received')).toBe(true)
      expect(shouldCheckGumPieceStatus('plan_expiring_soon')).toBe(true)
      expect(shouldCheckGumPieceStatus('invite_accepted')).toBe(false)
    })
  })

  describe('resolveStaleGumPieceTap', () => {
    it('dismisses stale plan_expiring_soon on expired piece', () => {
      expect(resolveStaleGumPieceTap('plan_expiring_soon', 'expired')).toEqual({
        dismiss: true,
        toast: 'This plan has already expired.',
      })
    })

    it('continues routing for active plan_expiring_soon', () => {
      expect(resolveStaleGumPieceTap('plan_expiring_soon', 'active')).toEqual({
        dismiss: false,
      })
    })

    it('dismisses stale invite_received on expired piece', () => {
      expect(resolveStaleGumPieceTap('invite_received', 'expired')).toEqual({
        dismiss: true,
        toast: 'This invite has expired.',
      })
    })

    it('continues when piece status is missing', () => {
      expect(resolveStaleGumPieceTap('plan_expiring_soon', null)).toEqual({
        dismiss: false,
      })
      expect(resolveStaleGumPieceTap('plan_expiring_soon', undefined)).toEqual({
        dismiss: false,
      })
    })
  })
})
