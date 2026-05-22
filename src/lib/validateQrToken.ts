export interface ValidateQrUser {
  display_name: string
  username: string
  avatar_url: string | null
}

interface ValidateQrSuccessResponse {
  success: boolean
  user: ValidateQrUser
}

export interface ValidateQrErrorResponse {
  error?: string
  error_code?: string
  user?: ValidateQrUser
}

export interface ValidateQrIssue {
  message: string
  type: 'expired' | 'own' | 'already_connected' | 'request_pending' | 'generic'
  connectedUser?: ValidateQrUser
}

const functionsBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export async function validateQrTokenRequest(params: {
  token: string
  accessToken: string
}): Promise<{ success: true; user: ValidateQrUser } | { success: false; error: ValidateQrErrorResponse }> {
  const response = await fetch(`${functionsBaseUrl}/validate-qr-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: publishableKey,
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({ token: params.token }),
  })

  const responseText = await response.text()
  let parsed: ValidateQrSuccessResponse | ValidateQrErrorResponse | null = null

  if (responseText) {
    try {
      parsed = JSON.parse(responseText) as ValidateQrSuccessResponse | ValidateQrErrorResponse
    } catch {
      parsed = null
    }
  }

  if (response.ok && parsed && 'success' in parsed && parsed.success) {
    return {
      success: true,
      user: parsed.user,
    }
  }

  return {
    success: false,
    error:
      parsed && typeof parsed === 'object' && 'error' in parsed
        ? (parsed as ValidateQrErrorResponse)
        : { error: responseText },
  }
}

export function mapValidateQrIssue(errorPayload: ValidateQrErrorResponse): ValidateQrIssue {
  const normalizedMessage = (errorPayload.error ?? '').toLowerCase()
  const errorCode = errorPayload.error_code ?? ''

  if (errorCode === 'expired' || normalizedMessage.includes('expired')) {
    return {
      message: 'This code has expired. Ask them to refresh.',
      type: 'expired',
    }
  }

  if (errorCode === 'already_connected' || normalizedMessage.includes('already connected')) {
    const name = errorPayload.user?.display_name ?? 'this person'
    return {
      message: `You're already connected with ${name}.`,
      type: 'already_connected',
      connectedUser: errorPayload.user,
    }
  }

  if (errorCode === 'request_pending' || normalizedMessage.includes('pending request')) {
    return {
      message: "There's already a pending request with this person.",
      type: 'request_pending',
    }
  }

  if (
    errorCode === 'own_qr' ||
    normalizedMessage.includes('own qr') ||
    normalizedMessage.includes('your own')
  ) {
    return {
      message: "That's your own code.",
      type: 'own',
    }
  }

  return {
    message: 'Something went wrong — try again.',
    type: 'generic',
  }
}
