import { supabase } from '@/lib/supabase'

export const MEDIA_LIMITS = {
  maxPostPhotos: 10,
  maxPostMedia: 10,
  maxPostVideos: 3,
  maxPostVideoSeconds: 60,
  maxImageBytes: 8 * 1024 * 1024,
  maxPostVideoBytes: 100 * 1024 * 1024,
  maxAvatarBytes: 5 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const,
  allowedVideoMimeTypes: ['video/mp4', 'video/quicktime', 'video/x-m4v'] as const,
  allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'] as const,
  allowedVideoExtensions: ['mp4', 'mov', 'm4v'] as const,
}

type PickedAsset = {
  uri?: string
  mimeType?: string | null
  fileSize?: number | null
  type?: string | null
  duration?: number | null
}

export type MediaValidationResult = {
  acceptedUris: string[]
  rejectedCount: number
}

export type ValidatedPostMedia = {
  uri: string
  type: 'image' | 'video'
  mimeType: string | null
}

export type PostMediaValidationResult = {
  acceptedMedia: ValidatedPostMedia[]
  rejectedCount: number
  error?: string | null
}

function isAllowedExtension(extension: string | undefined): boolean {
  // No extension (e.g. ph:// URIs from iOS media library) — rely on MIME type check alone.
  return !extension || (MEDIA_LIMITS.allowedExtensions as readonly string[]).includes(extension)
}

function isAllowedMimeType(mimeType: string | null | undefined): boolean {
  return !mimeType || (MEDIA_LIMITS.allowedMimeTypes as readonly string[]).includes(mimeType)
}

function isAllowedVideoExtension(extension: string | undefined): boolean {
  return !!extension && (MEDIA_LIMITS.allowedVideoExtensions as readonly string[]).includes(extension)
}

function isAllowedVideoMimeType(mimeType: string | null | undefined): boolean {
  return !!mimeType && (MEDIA_LIMITS.allowedVideoMimeTypes as readonly string[]).includes(mimeType)
}

export function validatePickedPostImages(
  assets: PickedAsset[],
  existingCount = 0
): MediaValidationResult {
  const acceptedUris: string[] = []
  const remaining = Math.max(0, MEDIA_LIMITS.maxPostPhotos - existingCount)

  for (const asset of assets) {
    if (acceptedUris.length >= remaining) break
    if (!asset.uri) continue
    if (asset.fileSize && asset.fileSize > MEDIA_LIMITS.maxImageBytes) continue

    const extension = asset.uri.split('?')[0]?.split('.').pop()?.toLowerCase()
    const hasAllowedExtension = isAllowedExtension(extension)
    const hasAllowedMime = isAllowedMimeType(asset.mimeType)

    if (!hasAllowedExtension || !hasAllowedMime) continue
    acceptedUris.push(asset.uri)
  }

  return {
    acceptedUris,
    rejectedCount: assets.length - acceptedUris.length,
  }
}

export function validatePickedPostMedia(
  assets: PickedAsset[],
  existingCount = 0
): PostMediaValidationResult {
  const acceptedMedia: ValidatedPostMedia[] = []
  const remaining = Math.max(0, MEDIA_LIMITS.maxPostMedia - existingCount)
  const existingVideos = 0

  for (const asset of assets) {
    if (acceptedMedia.length >= remaining) break
    if (!asset.uri) continue
    const extension = asset.uri.split('?')[0]?.split('.').pop()?.toLowerCase()
    const assetType = asset.type === 'video' ? 'video' : asset.type === 'image' ? 'image' : null
    const mimeType = asset.mimeType ?? null
    const looksVideo = assetType === 'video' || isAllowedVideoExtension(extension) || isAllowedVideoMimeType(mimeType)

    if (looksVideo) {
      const acceptedVideos = acceptedMedia.filter(item => item.type === 'video').length
      if (existingVideos + acceptedVideos >= MEDIA_LIMITS.maxPostVideos) continue
      if (asset.fileSize && asset.fileSize > MEDIA_LIMITS.maxPostVideoBytes) {
        return { acceptedMedia, rejectedCount: assets.length, error: 'Video exceeds 100 MB limit.' }
      }
      if (asset.duration && asset.duration > MEDIA_LIMITS.maxPostVideoSeconds * 1000) {
        return { acceptedMedia, rejectedCount: assets.length, error: 'Videos must be 60 seconds or less.' }
      }
      if (!isAllowedVideoExtension(extension) && !isAllowedVideoMimeType(mimeType)) continue
      acceptedMedia.push({ uri: asset.uri, type: 'video', mimeType })
      continue
    }

    if (asset.fileSize && asset.fileSize > MEDIA_LIMITS.maxImageBytes) continue
    if (!isAllowedExtension(extension) || !isAllowedMimeType(mimeType)) continue
    acceptedMedia.push({ uri: asset.uri, type: 'image', mimeType })
  }

  return {
    acceptedMedia,
    rejectedCount: assets.length - acceptedMedia.length,
    error: null,
  }
}

export const MESSAGE_MEDIA_LIMITS = {
  maxImageBytes: 10 * 1024 * 1024,
  maxVideoBytes: 100 * 1024 * 1024,
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const,
  allowedVideoTypes: ['video/mp4', 'video/quicktime', 'video/x-m4v'] as const,
}

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v',
}

export function validatePickedMessageAttachment(asset: PickedAsset | undefined): {
  uri: string | null
  mimeType: string | null
  error: string | null
} {
  if (!asset?.uri) return { uri: null, mimeType: null, error: 'No file selected.' }
  let mimeType = asset.mimeType ?? null
  if (!mimeType) {
    const ext = asset.uri.split('?')[0]?.split('.').pop()?.toLowerCase() ?? ''
    mimeType = EXT_TO_MIME[ext] ?? null
  }
  const isImage = mimeType && (MESSAGE_MEDIA_LIMITS.allowedImageTypes as readonly string[]).includes(mimeType)
  const isVideo = mimeType && (MESSAGE_MEDIA_LIMITS.allowedVideoTypes as readonly string[]).includes(mimeType)
  if (!isImage && !isVideo) return { uri: null, mimeType: null, error: 'Unsupported file type.' }
  if (isImage && asset.fileSize && asset.fileSize > MESSAGE_MEDIA_LIMITS.maxImageBytes) {
    return { uri: null, mimeType: null, error: 'Image exceeds 10 MB limit.' }
  }
  if (isVideo && asset.fileSize && asset.fileSize > MESSAGE_MEDIA_LIMITS.maxVideoBytes) {
    return { uri: null, mimeType: null, error: 'Video exceeds 100 MB limit.' }
  }
  return { uri: asset.uri, mimeType, error: null }
}

export function validatePickedAvatarImage(asset: PickedAsset | undefined): string | null {
  if (!asset?.uri) return null
  if (asset.fileSize && asset.fileSize > MEDIA_LIMITS.maxAvatarBytes) return null

  const extension = asset.uri.split('?')[0]?.split('.').pop()?.toLowerCase()
  const hasAllowedExtension = isAllowedExtension(extension)
  const hasAllowedMime = isAllowedMimeType(asset.mimeType)

  return hasAllowedExtension && hasAllowedMime ? asset.uri : null
}

export async function uploadAvatarImage(userId: string, uri: string): Promise<string> {
  const rawExt = uri.split('.').pop()?.toLowerCase() ?? 'jpg'
  const ext = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg'
  const contentType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
  const path = `${userId}/avatar.${ext}`
  const response = await fetch(uri)
  const blob = await response.blob()
  const arrayBuffer = await new Response(blob).arrayBuffer()
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, arrayBuffer, { contentType, upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}
