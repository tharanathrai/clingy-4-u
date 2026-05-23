export function extractQrToken(decodedValue: string): string | null {
  try {
    const url = new URL(decodedValue)
    return url.searchParams.get('token')
  } catch {
    const trimmedValue = decodedValue.trim()
    return trimmedValue.length > 0 ? trimmedValue : null
  }
}
