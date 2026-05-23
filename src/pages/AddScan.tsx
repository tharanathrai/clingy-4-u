import { ArrowLeft, Camera, ImageUp } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { ConnectionRequestSentModal } from '../components/connections/ConnectionRequestSentModal.tsx'
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
  type: 'expired' | 'own' | 'already_connected' | 'request_pending' | 'network' | 'generic'
  connectedUser?: ValidateQrUser
}

type ScanMode = 'camera' | 'image'

const QR_READER_ID = 'qr-reader'

export default function AddScan() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [scanMode, setScanMode] = useState<ScanMode>('camera')
  const [scannedToken, setScannedToken] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successUser, setSuccessUser] = useState<ValidateQrUser | null>(null)
  const [scanIssue, setScanIssue] = useState<ScanIssue | null>(null)
  const [imageFileName, setImageFileName] = useState<string | null>(null)

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

  const handleDecodedText = useCallback(
    (decodedText: string) => {
      const token = extractQrToken(decodedText)
      if (!token) {
        setScanError('Unable to read token from this code.')
        return
      }

      setScanError(null)
      setScanIssue(null)
      setScannedToken(token)
      void stopScanner()
    },
    [stopScanner],
  )

  useEffect(() => {
    if (scanMode !== 'camera' || scannedToken || successUser) {
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
  }, [handleDecodedText, scanMode, scannedToken, stopScanner, successUser])

  const sendRequest = async () => {
    if (!scannedToken) {
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
        setSubmitting(false)
        return
      }

      setSuccessUser(result.user)
    } catch {
      setScanIssue({
        message: 'Something went wrong — try again.',
        type: 'network',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const resetScanner = () => {
    setScannedToken(null)
    setScanError(null)
    setScanIssue(null)
    setSuccessUser(null)
    setImageFileName(null)
    setCameraError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleModeChange = (mode: ScanMode) => {
    if (mode === scanMode) {
      return
    }

    setScanMode(mode)
    setScannedToken(null)
    setScanError(null)
    setScanIssue(null)
    setImageFileName(null)
    setCameraError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImageSelected = async (file: File | null) => {
    if (!file) {
      return
    }

    setScanError(null)
    setScanIssue(null)
    setImageFileName(file.name)
    setScannedToken(null)

    await stopScanner()

    const scanner = new Html5Qrcode(QR_READER_ID, false)
    scannerRef.current = scanner

    try {
      const decodedText = await scanner.scanFile(file, false)
      handleDecodedText(decodedText)
    } catch {
      setScanError('No QR code found in that image.')
    }
  }

  return (
    <main className="safe-screen-height safe-content-bottom safe-content-top mx-auto flex w-full max-w-md flex-col overflow-y-auto bg-bg px-5 py-8 text-text">
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-2 self-start text-sm text-text-2"
        onClick={() => {
          if (window.history.length > 1) {
            navigate(-1)
            return
          }
          navigate('/add')
        }}
      >
        <ArrowLeft size={18} strokeWidth={1.75} />
        Back
      </button>

      <h1 className="mt-4 text-center font-display text-4xl">Scan code</h1>
      <p className="mt-2 text-center text-sm text-text-2">
        Point your camera at their code, or upload a photo.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-surface p-1">
        <button
          type="button"
          onClick={() => handleModeChange('camera')}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition active:scale-95 ${
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
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition active:scale-95 ${
            scanMode === 'image'
              ? 'bg-accent text-white'
              : 'text-text-2 hover:text-text'
          }`}
        >
          <ImageUp size={16} strokeWidth={1.75} />
          Scan image
        </button>
      </div>

      {scanMode === 'camera' ? (
        <div className="qr-reader-container mt-6 rounded-lg border border-white/10 bg-surface p-4">
          <div id={QR_READER_ID} />
        </div>
      ) : (
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
            className="mt-5 rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white transition hover:opacity-90 active:scale-95"
          >
            Choose image
          </button>
          {imageFileName ? (
            <p className="mt-3 truncate text-xs text-text-3">{imageFileName}</p>
          ) : null}
        </section>
          <div id={QR_READER_ID} className="hidden" aria-hidden="true" />
        </>
      )}

      {cameraError ? <p className="mt-4 text-sm text-playful">{cameraError}</p> : null}
      {scanError ? <p className="mt-4 text-sm text-playful">{scanError}</p> : null}

      {scannedToken ? (
        <button
          type="button"
          className="mt-4 rounded-full bg-accent px-7 py-3.5 text-sm font-medium text-white transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => void sendRequest()}
          disabled={submitting}
        >
          {submitting ? 'Sending request...' : 'Send request'}
        </button>
      ) : null}

      {scanIssue ? (
        <div className="mt-4 rounded-lg border border-white/10 bg-surface-2 p-3 text-left">
          <p className="text-sm text-playful">{scanIssue.message}</p>
          <div className="mt-3 flex items-center gap-2">
            {(
              scanIssue.type === 'expired' ||
              scanIssue.type === 'own' ||
              scanIssue.type === 'request_pending' ||
              scanIssue.type === 'generic'
            ) ? (
              <button
                type="button"
                onClick={() => setScanIssue(null)}
                className="rounded-full bg-surface px-4 py-2 text-xs text-text-2"
              >
                Dismiss
              </button>
            ) : null}
            {scanIssue.type === 'network' ? (
              <button
                type="button"
                onClick={() => void sendRequest()}
                className="rounded-full bg-surface px-4 py-2 text-xs text-text-2"
              >
                Retry
              </button>
            ) : null}
            {scanIssue.type === 'already_connected' && scanIssue.connectedUser?.username ? (
              <Link
                to={`/profile/${scanIssue.connectedUser.username}`}
                className="rounded-full bg-accent px-4 py-2 text-xs text-white"
              >
                View profile
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-auto pt-8">
        <Link
          to="/add"
          className="block rounded-full bg-surface-2 px-7 py-3.5 text-center text-sm font-medium text-text-2"
        >
          Show my code instead
        </Link>
      </div>

      <ConnectionRequestSentModal
        open={successUser !== null}
        user={successUser}
        onClose={resetScanner}
      />
    </main>
  )
}

function toScanIssue(issue: ValidateQrIssue): ScanIssue {
  return {
    message: issue.message,
    type: issue.type,
    connectedUser: issue.connectedUser,
  }
}
