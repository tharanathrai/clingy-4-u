import { useEffect, useId, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { AvatarCropSheet } from './AvatarCropSheet.tsx'
import { revokeObjectUrl } from '../../lib/avatarImage.ts'

type ProfileAvatarFieldSize = 'md' | 'lg'

interface ProfileAvatarFieldProps {
  displayName: string
  imageUrl: string | null
  fallbackInitial: string
  size?: ProfileAvatarFieldSize
  allowRemove?: boolean
  onImageReady: (blob: Blob | null) => void
}

const sizeClasses: Record<ProfileAvatarFieldSize, string> = {
  md: 'h-24 w-24 text-2xl',
  lg: 'h-32 w-32 text-4xl',
}

const cameraBadgeClasses: Record<ProfileAvatarFieldSize, string> = {
  md: 'bottom-0 right-0 h-8 w-8',
  lg: 'bottom-0.5 right-0.5 h-9 w-9',
}

const cameraIconSizes: Record<ProfileAvatarFieldSize, number> = {
  md: 14,
  lg: 16,
}

export function ProfileAvatarField({
  displayName,
  imageUrl,
  fallbackInitial,
  size = 'md',
  allowRemove = false,
  onImageReady,
}: ProfileAvatarFieldProps) {
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)
  const [isCropOpen, setIsCropOpen] = useState(false)
  const [removed, setRemoved] = useState(false)

  const previewUrl = removed ? null : (localPreviewUrl ?? imageUrl)
  const showRemove = allowRemove && Boolean(previewUrl)

  useEffect(() => {
    return () => {
      revokeObjectUrl(localPreviewUrl)
      revokeObjectUrl(cropSourceUrl)
    }
  }, [cropSourceUrl, localPreviewUrl])

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    revokeObjectUrl(cropSourceUrl)
    const sourceUrl = URL.createObjectURL(file)
    setCropSourceUrl(sourceUrl)
    setIsCropOpen(true)
    setRemoved(false)
  }

  const handleCropClose = () => {
    setIsCropOpen(false)
    revokeObjectUrl(cropSourceUrl)
    setCropSourceUrl(null)
  }

  const handleCropConfirm = (blob: Blob) => {
    const nextPreviewUrl = URL.createObjectURL(blob)
    setLocalPreviewUrl((previous) => {
      revokeObjectUrl(previous)
      return nextPreviewUrl
    })
    setRemoved(false)
    onImageReady(blob)
    setIsCropOpen(false)
    revokeObjectUrl(cropSourceUrl)
    setCropSourceUrl(null)
  }

  const handleRemove = () => {
    setLocalPreviewUrl((previous) => {
      revokeObjectUrl(previous)
      return null
    })
    setRemoved(true)
    onImageReady(null)
  }

  const dimensionClass = sizeClasses[size]
  const badgeClass = cameraBadgeClasses[size]

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <button
          type="button"
          onClick={openFilePicker}
          className={`relative overflow-hidden rounded-full border-2 border-white bg-surface-2 transition hover:scale-[1.03] active:scale-[0.98] ${dimensionClass}`}
          aria-label={previewUrl ? 'Change profile photo' : 'Add profile photo'}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-medium text-text">
              {fallbackInitial}
            </span>
          )}
        </button>
        <span
          className={`pointer-events-none absolute flex items-center justify-center rounded-full border-2 border-surface bg-accent text-white ${badgeClass}`}
          aria-hidden
        >
          <Camera size={cameraIconSizes[size]} strokeWidth={1.75} />
        </span>
      </div>

      {showRemove ? (
        <button
          type="button"
          onClick={handleRemove}
          className="inline-flex min-h-11 items-center justify-center px-2 text-sm text-playful underline-offset-2 transition hover:underline active:scale-[0.98]"
        >
          Remove photo
        </button>
      ) : null}

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
      />

      {cropSourceUrl ? (
        <AvatarCropSheet
          imageSrc={cropSourceUrl}
          isOpen={isCropOpen}
          onClose={handleCropClose}
          onConfirm={handleCropConfirm}
        />
      ) : null}
    </div>
  )
}
