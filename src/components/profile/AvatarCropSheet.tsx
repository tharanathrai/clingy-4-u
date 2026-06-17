import { useCallback, useEffect, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { getCroppedImageBlob, revokeObjectUrl } from '../../lib/avatarImage.ts'

interface AvatarCropSheetProps {
  imageSrc: string
  isOpen: boolean
  onClose: () => void
  onConfirm: (blob: Blob) => void
}

export function AvatarCropSheet({ imageSrc, isOpen, onClose, onConfirm }: AvatarCropSheetProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
      setConfirming(false)
      setErrorMessage(null)
      setPreviewUrl((previous) => {
        revokeObjectUrl(previous)
        return null
      })
    }
  }, [isOpen])

  useEffect(() => {
    return () => {
      revokeObjectUrl(previewUrl)
    }
  }, [previewUrl])

  const updatePreview = useCallback(
    async (area: Area) => {
      try {
        const blob = await getCroppedImageBlob(imageSrc, area)
        const nextUrl = URL.createObjectURL(blob)
        setPreviewUrl((previous) => {
          revokeObjectUrl(previous)
          return nextUrl
        })
      } catch {
        setPreviewUrl((previous) => {
          revokeObjectUrl(previous)
          return null
        })
      }
    },
    [imageSrc],
  )

  useEffect(() => {
    if (!isOpen || !croppedAreaPixels) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void updatePreview(croppedAreaPixels)
    }, 150)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [croppedAreaPixels, isOpen, updatePreview])

  const handleCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  const handleConfirm = async () => {
    if (!croppedAreaPixels) {
      return
    }

    setConfirming(true)
    setErrorMessage(null)

    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels)
      onConfirm(blob)
    } catch {
      setErrorMessage('Could not process that image — try another.')
      setConfirming(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <section className="app-fixed-viewport z-50">
      <button
        type="button"
        aria-label="Close crop"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="absolute inset-x-0 bottom-0 app-fixed-frame-inner flex max-h-[92vh] flex-col rounded-t-xl border-t border-white/10 bg-surface pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-white/20" />
        <h2 className="shrink-0 px-5 font-display text-2xl text-text">Adjust photo</h2>
        <p className="mt-1 shrink-0 px-5 text-sm text-text-2">Pinch or drag to position your photo.</p>

        <div className="relative mx-5 mt-4 h-64 shrink-0 overflow-hidden rounded-lg bg-bg">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <label className="mx-5 mt-4 shrink-0 text-xs uppercase text-text-3">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(event) => {
              setZoom(Number(event.target.value))
            }}
            className="mt-2 w-full accent-accent"
          />
        </label>

        <div className="mx-5 mt-4 flex shrink-0 items-center gap-4">
          <span className="text-xs uppercase text-text-3">Preview</span>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Avatar preview"
              className="h-16 w-16 rounded-full border-2 border-white object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded-full border-2 border-white/20 bg-surface-2" />
          )}
        </div>

        {errorMessage ? (
          <p className="mx-5 mt-3 shrink-0 text-sm text-playful">{errorMessage}</p>
        ) : null}

        <div className="mx-5 mt-6 flex shrink-0 gap-3">
          <button
            type="button"
            className="flex-1 rounded-full bg-surface-2 px-5 py-3 text-sm text-text-2 transition active:scale-[0.98] disabled:opacity-50"
            onClick={onClose}
            disabled={confirming}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary flex-1 rounded-full bg-accent px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              void handleConfirm()
            }}
            disabled={confirming || !croppedAreaPixels}
          >
            {confirming ? 'Processing...' : 'Use photo'}
          </button>
        </div>
      </div>
    </section>
  )
}
