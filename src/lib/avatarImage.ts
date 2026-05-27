import { AVATAR_EXPORT_SIZE, AVATAR_JPEG_QUALITY } from './constants.ts'

export interface PixelCrop {
  x: number
  y: number
  width: number
  height: number
}

export function revokeObjectUrl(url: string | null | undefined): void {
  if (url) {
    URL.revokeObjectURL(url)
  }
}

function createImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => {
      resolve(image)
    })
    image.addEventListener('error', () => {
      reject(new Error('Failed to load image'))
    })
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })
}

export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: PixelCrop,
  maxSize: number = AVATAR_EXPORT_SIZE,
  quality: number = AVATAR_JPEG_QUALITY,
): Promise<Blob> {
  const image = await createImageElement(imageSrc)
  const canvas = document.createElement('canvas')
  const outputSize = maxSize
  canvas.width = outputSize
  canvas.height = outputSize

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas is not supported')
  }

  context.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create image'))
          return
        }
        resolve(blob)
      },
      'image/jpeg',
      quality,
    )
  })
}
