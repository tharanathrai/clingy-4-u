import { Camera, ImageUp, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { ConnectionRequestSentModal } from '../components/connections/ConnectionRequestSentModal.tsx'
import { BackHeader } from '../components/layout/BackHeader.tsx'
import { pageShellJourneyScroll } from '../components/layout/pageShell.ts'
import { extractQrToken } from '../lib/extractQrToken.ts'
import { supabase } from '../lib/supabase.ts'
import {
  type ValidateQrIssue,
  type ValidateQrUser,
  mapValidateQrIssue,
  validateQrTokenRequest,
} from '../lib/validateQrToken.ts'

interface ScanIssue {
  message: string
  type: ValidateQrIssue['type']
  connectedUser?: ValidateQrUser
}

type ScanMode = 'camera' | 'image'

const QR_READER_ID = 'qr-reader'

export default function AddScan() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const handledTokenRef = useRef<string | null>(null)
  const [scanMode, setScanMode] = useState<ScanMode>('camera')
  const [scannedToken, setScannedToken] = useState<string | null>(null)
  const [validatedUser, setValidatedUser] = useState<ValidateQrUser | null>(null)
  const [validating, setValidating] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successUser, setSuccessUser] = useState<ValidateQrUser | null>(null)
  const [scanIssue, setScanIssue] = useState<ScanIssue | null>(null)
  const [imageFileName, setImageFileName] = useState<string | null>(null)

  const awaitingScanResult =
    validating ||
    validatedUser !== null ||
    successUser !== null ||
    scanIssue !== null ||
    scanError !== null ||
    scannedToken !== null

  const showScanInput = !awaitingScanResult

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current
    if (!scanner) {
      return
    }

    try {
      if (scanner.isScanning) {
        await scanner.stop()
      }
      await scanner.clear()
    } catch {
      // Scanner teardown can fail if the camera was already released.
    }

    scannerRef.current = null
  }, [])

  const clearScanState = useCallback(() => {
    handledTokenRef.current = null
    setScannedToken(null)
    setValidatedUser(null)
    setScanError(null)
    setScanIssue(null)
    setImageFileName(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const dismissScanResult = useCallback(() => {
    clearScanState()
  }, [clearScanState])

  const validateScannedToken = useCallback(async (token: string) => {
    setValidating(true)
    setScanIssue(null)
    setScanError(null)
    setValidatedUser(null)

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token

    if (sessionError || !accessToken) {
      setScanIssue({
        message: 'No active session. Please sign in again.',
        type: 'generic',
      })
      setValidating(false)
      return
    }

    try {
      const result = await validateQrTokenRequest({
        token,
        accessToken,
        preview: true,
      })

      if (!result.success) {
        setScanIssue(toScanIssue(mapValidateQrIssue(result.error)))
        setValidating(false)
        return
      }

      setValidatedUser(result.user)
    } catch {
      setScanIssue({
        message: 'Something went wrong — try again.',
        type: 'network',
      })
    } finally {
      setValidating(false)
    }
  }, [])

  const beginTokenScan = useCallback(
    (token: string) => {
      if (handledTokenRef.current === token) {
        return
      }

      handledTokenRef.current = token
      setScanError(null)
      setScanIssue(null)
      setValidatedUser(null)
      setScannedToken(token)
      void stopScanner()
      void validateScannedToken(token)
    },
    [stopScanner, validateScannedToken],
  )

  const handleDecodedText = useCallback(
    (decodedText: string) => {
      const token = extractQrToken(decodedText)
      if (!token) {
        if (handledTokenRef.current === '__invalid_format__') {
          return
        }
        handledTokenRef.current = '__invalid_format__'
        setScanError('This is not a Clingy connection code.')
        return
      }

      beginTokenScan(token)
    },
    [beginTokenScan],
  )

  useEffect(() => {
    if (scanMode !== 'camera' || !showScanInput) {
      void stopScanner()
      return
    }

    let cancelled = false
    setCameraError(null)

    const scanner = new Html5Qrcode(QR_READER_ID, false)
    scannerRef.current = scanner

    void scanner
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 260, height: 260 },
        },
        (decodedText) => {
          handleDecodedText(decodedText)
        },
        () => {
          // Continuous scanner callback intentionally ignored.
        },
      )
      .catch(() => {
        if (!cancelled) {
          setCameraError('Could not access camera. Try scanning an image instead.')
        }
      })

    return () => {
      cancelled = true
      void stopScanner()
    }
  }, [handleDecodedText, scanMode, showScanInput, stopScanner])

  const sendRequest = async () => {
    if (!scannedToken || !validatedUser) {
      return
    }

    setSubmitting(true)
    setScanIssue(null)

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token

    if (sessionError || !accessToken) {
      setScanIssue({
        message: 'No active session. Please sign in again.',
        type: 'generic',
      })
      setSubmitting(false)
      return
    }

    try {
      const result = await validateQrTokenRequest({
        token: scannedToken,
        accessToken,
      })

      if (!result.success) {
        const issue = mapValidateQrIssue(result.error)
        setScanIssue(toScanIssue(issue))
        setValidatedUser(null)
        if (issue.type === 'expired' || issue.type === 'own' || issue.type === 'invalid_token') {
          // Keep scannedToken so the camera stays paused until dismiss.
        }
        setSubmitting(false)
        return
      }

      setSuccessUser(result.user)
    } catch {
      setScanIssue({
        message: 'Something went wrong — try again.',
        type: 'network',
      })
      setValidatedUser(null)
    } finally {
      setSubmitting(false)
    }
  }

  const resetScanner = () => {
    clearScanState()
    setSuccessUser(null)
    setCameraError(null)
  }

  const handleModeChange = (mode: ScanMode) => {
    if (mode === scanMode) {
      return
    }

    setScanMode(mode)
    clearScanState()
    setCameraError(null)
  }

  const handleImageSelected = async (file: File | null) => {
    if (!file || awaitingScanResult) {
      return
    }

    setScanError(null)
    setScanIssue(null)
    setValidatedUser(null)
    setScannedToken(null)
    setImageFileName(file.name)
    handledTokenRef.current = null

    await stopScanner()

    const scanner = new Html5Qrcode(QR_READER_ID, false)
    scannerRef.current = scanner

    try {
      const decodedText = await scanner.scanFile(file, false)
      const token = extractQrToken(decodedText)
      if (!token) {
        handledTokenRef.current = '__invalid_format__'
        setScanError('This is not a Clingy connection code.')
        return
      }

      beginTokenScan(token)
    } catch {
      handledTokenRef.current = '__invalid_format__'
      setScanError('No QR code found in that image.')
    }
  }

  return (
    <main className={pageShellJourneyScroll}>
      <BackHeader
        onBack={() => {
          if (window.history.length > 1) {
            navigate(-1)
            return
          }
          navigate('/add')
        }}
      />

      <h1 className="app-page-title text-center">scan code</h1>
      <p className="mt-2 text-center text-sm text-text-2">
        Point your camera at their code, or upload a photo.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-surface p-1">
        <button
          type="button"
          onClick={() => handleModeChange('camera')}
          disabled={awaitingScanResult || submitting}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition active:scale-95 disabled:opacity-60 ${
            scanMode === 'camera'
              ? 'bg-accent text-white'
              : 'text-text-2 hover:text-text'
          }`}
        >
          <Camera size={16} strokeWidth={1.75} />
          Use camera
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('image')}
          disabled={awaitingScanResult || submitting}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition active:scale-95 disabled:opacity-60 ${
            scanMode === 'image'
              ? 'bg-accent text-white'
              : 'text-text-2 hover:text-text'
          }`}
        >
          <ImageUp size={16} strokeWidth={1.75} />
          Scan image
        </button>
      </div>

      {showScanInput && scanMode === 'camera' ? (
        <div className="qr-reader-container mt-6 rounded-lg border border-white/10 bg-surface p-4">
          <div id={QR_READER_ID} />
        </div>
      ) : null}

      {showScanInput && scanMode === 'image' ? (
        <>
          <section className="mt-6 rounded-lg border border-white/10 bg-surface p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-accent">
              <ImageUp size={24} strokeWidth={1.75} />
            </div>
            <p className="mt-4 text-sm text-text-2">
              Choose a photo that includes their QR code.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                void handleImageSelected(file)
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary mt-5 rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white"
            >
              Choose image
            </button>
            {imageFileName ? (
              <p className="mt-3 truncate text-xs text-text-3">{imageFileName}</p>
            ) : null}
          </section>
          <div id={QR_READER_ID} className="hidden" aria-hidden="true" />
        </>
      ) : null}

      {validating ? (
        <section className="mt-6 rounded-lg border border-white/10 bg-surface p-6 text-center">
          <p className="text-sm text-text-2">Checking code...</p>
        </section>
      ) : null}

      {validatedUser && !successUser && !scanIssue ? (
        <section className="mt-6 rounded-lg border border-white/10 bg-surface p-6 text-center">
          <p className="text-sm text-text-2">Connect with</p>
          <p className="mt-2 text-lg text-text">{validatedUser.display_name}</p>
          <p className="text-sm text-text-2">@{validatedUser.username}</p>
        </section>
      ) : null}

      {cameraError ? (
        <ScanResultBanner message={cameraError} onDismiss={() => setCameraError(null)} />
      ) : null}

      {scanError ? (
        <ScanResultBanner message={scanError} onDismiss={dismissScanResult} />
      ) : null}

      {validatedUser && !successUser && !scanIssue ? (
        <button
          type="button"
          className="btn-primary mt-4 rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => void sendRequest()}
          disabled={submitting}
        >
          {submitting ? 'Sending request...' : 'Send request'}
        </button>
      ) : null}

      {scanIssue ? (
        <ScanResultBanner message={scanIssue.message} onDismiss={dismissScanResult}>
          {scanIssue.type === 'network' && scannedToken ? (
            <button
              type="button"
              onClick={() => void validateScannedToken(scannedToken)}
              className="rounded-full bg-surface px-4 py-2 text-xs text-text-2"
            >
              Retry
            </button>
          ) : null}
          {scanIssue.type === 'already_connected' && scanIssue.connectedUser?.username ? (
            <Link
              to={`/profile/${scanIssue.connectedUser.username}`}
              className="btn-primary rounded-full bg-accent px-4 py-2 text-xs text-white"
            >
              View profile
            </Link>
          ) : null}
        </ScanResultBanner>
      ) : null}

      <ConnectionRequestSentModal
        open={successUser !== null}
        user={successUser}
        onClose={resetScanner}
      />
    </main>
  )
}

function ScanResultBanner({
  message,
  onDismiss,
  children,
}: {
  message: string
  onDismiss: () => void
  children?: ReactNode
}) {
  return (
    <div className="relative mt-4 rounded-lg border border-white/10 bg-surface-2 p-4 pr-11 text-left">
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-2 top-2 flex min-h-11 min-w-11 items-center justify-center rounded-full text-text-2 transition hover:bg-surface hover:text-text active:scale-95"
        aria-label="Dismiss"
      >
        <X size={18} strokeWidth={1.75} />
      </button>
      <p className="text-sm text-playful">{message}</p>
      {children ? <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  )
}

function toScanIssue(issue: ValidateQrIssue): ScanIssue {
  return {
    message: issue.message,
    type: issue.type,
    connectedUser: issue.connectedUser,
  }
}
