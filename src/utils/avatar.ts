export function withAvatarSize(
  url: string | null | undefined,
  size: number,
): string | null {
  if (!url) {
    return null
  }

  try {
    const parsed = new URL(url)
    parsed.searchParams.set('width', String(size))
    parsed.searchParams.set('height', String(size))
    return parsed.toString()
  } catch {
    return url
  }
}
