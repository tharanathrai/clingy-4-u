/**
 * Tests for src/lib/avatarCleanup.ts
 *
 * The `avatars` bucket is public and nothing ever removed the previous object,
 * so a "removed" photo stayed publicly fetchable at its URL forever. These
 * pin the selection rules for what counts as an orphan, including the
 * folder-placeholder entries (`id: null`) that `.remove()` silently ignores.
 */

import { describe, it, expect } from 'vitest'
import {
  avatarObjectPath,
  avatarPathFromUrl,
  avatarPathsFromList,
  chunk,
  orphanAvatarPaths,
  type StorageEntry,
} from '../lib/avatarCleanup.ts'

const USER = '7100d9a4-2763-42f1-add4-cd82ea8725e4'
const PUBLIC_BASE = 'https://example.supabase.co/storage/v1/object/public/avatars'

const entry = (name: string, id: string | null = 'obj-id'): StorageEntry => ({ name, id })

describe('avatarObjectPath', () => {
  it('prefixes the object with the user id', () => {
    expect(avatarObjectPath(USER, 'abc-123')).toBe(`${USER}/abc-123.jpg`)
  })
})

describe('avatarPathFromUrl', () => {
  it('recovers the object path from a public url', () => {
    expect(avatarPathFromUrl(`${PUBLIC_BASE}/${USER}/abc.jpg`)).toBe(`${USER}/abc.jpg`)
  })

  it('strips a cache-busting query string', () => {
    expect(avatarPathFromUrl(`${PUBLIC_BASE}/${USER}/abc.jpg?t=17`)).toBe(`${USER}/abc.jpg`)
  })

  it('returns null for no avatar', () => {
    expect(avatarPathFromUrl(null)).toBeNull()
  })

  it('returns null for a url outside the avatars bucket', () => {
    expect(avatarPathFromUrl('https://lh3.googleusercontent.com/a/photo.jpg')).toBeNull()
  })

  it('returns null for a path that is not <userId>/<file>', () => {
    expect(avatarPathFromUrl(`${PUBLIC_BASE}/${USER}`)).toBeNull()
    expect(avatarPathFromUrl(`${PUBLIC_BASE}/${USER}/nested/deep.jpg`)).toBeNull()
  })
})

describe('avatarPathsFromList', () => {
  it('builds full paths under the user prefix', () => {
    expect(avatarPathsFromList(USER, [entry('a.jpg'), entry('b.jpg')])).toEqual([
      `${USER}/a.jpg`,
      `${USER}/b.jpg`,
    ])
  })

  it('skips folder placeholders, which remove() ignores', () => {
    const entries = [entry('a.jpg'), entry('nested', null), entry('b.jpg')]
    expect(avatarPathsFromList(USER, entries)).toEqual([`${USER}/a.jpg`, `${USER}/b.jpg`])
  })

  it('skips entries with an undefined id', () => {
    expect(avatarPathsFromList(USER, [{ name: 'a.jpg' }])).toEqual([])
  })

  it('returns nothing for an empty listing', () => {
    expect(avatarPathsFromList(USER, [])).toEqual([])
  })
})

describe('orphanAvatarPaths', () => {
  it('keeps the live object and returns the rest', () => {
    const entries = [entry('old.jpg'), entry('current.jpg'), entry('older.jpg')]
    const live = `${PUBLIC_BASE}/${USER}/current.jpg`
    expect(orphanAvatarPaths(USER, entries, live)).toEqual([
      `${USER}/old.jpg`,
      `${USER}/older.jpg`,
    ])
  })

  it('treats every object as an orphan when the profile has no avatar', () => {
    const entries = [entry('old.jpg'), entry('older.jpg')]
    expect(orphanAvatarPaths(USER, entries, null)).toEqual([
      `${USER}/old.jpg`,
      `${USER}/older.jpg`,
    ])
  })

  it('ignores a cache-busting query string on the live url', () => {
    const entries = [entry('current.jpg'), entry('old.jpg')]
    const live = `${PUBLIC_BASE}/${USER}/current.jpg?t=1758153600`
    expect(orphanAvatarPaths(USER, entries, live)).toEqual([`${USER}/old.jpg`])
  })

  it('does not match on a filename that is merely a suffix of another', () => {
    // '1.jpg' must not be treated as live just because the url ends with '11.jpg'.
    const entries = [entry('1.jpg'), entry('11.jpg')]
    const live = `${PUBLIC_BASE}/${USER}/11.jpg`
    expect(orphanAvatarPaths(USER, entries, live)).toEqual([`${USER}/1.jpg`])
  })

  it('returns nothing when the only object is the live one', () => {
    const live = `${PUBLIC_BASE}/${USER}/current.jpg`
    expect(orphanAvatarPaths(USER, [entry('current.jpg')], live)).toEqual([])
  })

  it('does not remove another user’s object when the url points elsewhere', () => {
    const entries = [entry('current.jpg')]
    const live = `${PUBLIC_BASE}/someone-else/current.jpg`
    expect(orphanAvatarPaths(USER, entries, live)).toEqual([`${USER}/current.jpg`])
  })
})

describe('chunk', () => {
  it('splits into batches with a remainder', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('splits evenly when the size divides the length', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]])
  })

  it('handles an empty list and a size of one', () => {
    expect(chunk([], 10)).toEqual([])
    expect(chunk([1, 2], 1)).toEqual([[1], [2]])
  })

  it('rejects a size below one rather than looping forever', () => {
    expect(() => chunk([1], 0)).toThrow('chunk size must be >= 1')
  })
})
