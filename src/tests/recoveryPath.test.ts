import { describe, it, expect } from 'vitest'
import { resolvePostAuthPath, resolveRecoveryPath } from '../lib/recoveryPath.ts'

describe('resolveRecoveryPath', () => {
  it('returns / while auth or profile state is loading', () => {
    expect(
      resolveRecoveryPath({
        hasUser: true,
        profileReady: false,
        authLoading: true,
        profileLoading: false,
      }),
    ).toBe('/')

    expect(
      resolveRecoveryPath({
        hasUser: true,
        profileReady: false,
        authLoading: false,
        profileLoading: true,
      }),
    ).toBe('/')
  })

  it('returns / for signed-out users', () => {
    expect(
      resolveRecoveryPath({
        hasUser: false,
        profileReady: null,
        authLoading: false,
        profileLoading: false,
      }),
    ).toBe('/')
  })

  it('returns /welcome for authenticated users without a profile', () => {
    expect(
      resolveRecoveryPath({
        hasUser: true,
        profileReady: false,
        authLoading: false,
        profileLoading: false,
      }),
    ).toBe('/welcome')
  })

  it('returns /home for onboarded users', () => {
    expect(
      resolveRecoveryPath({
        hasUser: true,
        profileReady: true,
        authLoading: false,
        profileLoading: false,
      }),
    ).toBe('/home')
  })
})

describe('resolvePostAuthPath', () => {
  it('returns stored return path for onboarded users when valid', () => {
    expect(resolvePostAuthPath(true, '/connect?token=abc')).toBe('/connect?token=abc')
  })

  it('ignores invalid stored return paths', () => {
    expect(resolvePostAuthPath(true, 'https://evil.test')).toBe('/home')
  })

  it('returns /welcome for new users without a profile', () => {
    expect(resolvePostAuthPath(false, null)).toBe('/welcome')
  })

  it('returns /home for returning users without a stored return path', () => {
    expect(resolvePostAuthPath(true, null)).toBe('/home')
  })
})
