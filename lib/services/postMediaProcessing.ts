// react-native-compressor is a native module unavailable in Expo Go / unlinked builds.
// Dynamic require + try-catch is intentional — do NOT convert to a static import.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let CompressorImage: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let CompressorVideo: any = null
try {
  const mod = require('react-native-compressor')
  CompressorImage = mod.Image
  CompressorVideo = mod.Video
} catch {
  // Not linked — Expo Go or dev build without native module; compression skipped
}
import { MEDIA_LIMITS, validatePickedPostMedia } from '@/lib/services/media'
import type { PostMediaAsset, PostMediaProcessingStatus } from '@/types/domain'

type PickedAsset = {
  uri?: string
  mimeType?: string | null
  fileSize?: number | null
  type?: string | null
  duration?: number | null
  width?: number | null
  height?: number | null
}

export type PreparedMediaResult = {
  media: PostMediaAsset[]
  rejectedCount: number
  error?: string | null
}

export type MediaProgress = {
  localId: string
  status: PostMediaProcessingStatus
  progress?: number
}

function localId(): string {
  return `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function shouldCompressImage(asset: PickedAsset): boolean {
  return !!asset.fileSize && asset.fileSize > MEDIA_LIMITS.maxImageBytes * 0.65
}

function shouldCompressVideo(asset: PickedAsset): boolean {
  return !!asset.fileSize && asset.fileSize > 18 * 1024 * 1024
}

async function prepareImage(asset: PickedAsset, onProgress?: (progress: MediaProgress) => void): Promise<PostMediaAsset> {
  const id = localId()
  onProgress?.({ localId: id, status: 'preparing', progress: 0.15 })
  let uri = asset.uri!
  try {
    if (CompressorImage && shouldCompressImage(asset)) {
      uri = await CompressorImage.compress(uri, {
        compressionMethod: 'auto',
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.82,
      })
    }
  } catch {
    uri = asset.uri!
  }
  onProgress?.({ localId: id, status: 'ready', progress: 1 })
  return {
    localId: id,
    uri,
    type: 'image',
    mimeType: asset.mimeType ?? null,
    originalUrl: asset.uri,
    processedUrl: uri,
    sizeBytes: asset.fileSize ?? null,
    width: asset.width ?? null,
    height: asset.height ?? null,
    processingStatus: 'ready',
  }
}

async function prepareVideo(asset: PickedAsset, onProgress?: (progress: MediaProgress) => void): Promise<PostMediaAsset> {
  const id = localId()
  onProgress?.({ localId: id, status: 'preparing', progress: 0.05 })
  let uri = asset.uri!
  try {
    if (CompressorVideo && shouldCompressVideo(asset)) {
      uri = await CompressorVideo.compress(
        uri,
        {
          compressionMethod: 'manual',
          maxSize: 1280,
          bitrate: 4_800_000,
          minimumFileSizeForCompress: 18,
        },
        (progress: number) => onProgress?.({ localId: id, status: 'preparing', progress })
      )
    }
  } catch (e: any) {
    if (asset.fileSize && asset.fileSize > MEDIA_LIMITS.maxPostVideoBytes) {
      return {
        localId: id,
        uri: asset.uri!,
        type: 'video',
        mimeType: asset.mimeType ?? null,
        sizeBytes: asset.fileSize ?? null,
        durationMs: asset.duration ?? null,
        width: asset.width ?? null,
        height: asset.height ?? null,
        processingStatus: 'failed',
        processingError: e?.message ?? 'Video compression failed.',
      }
    }
    uri = asset.uri!
  }
  onProgress?.({ localId: id, status: 'ready', progress: 1 })
  return {
    localId: id,
    uri,
    type: 'video',
    mimeType: asset.mimeType ?? null,
    originalUrl: asset.uri,
    processedUrl: uri,
    sizeBytes: asset.fileSize ?? null,
    durationMs: asset.duration ?? null,
    width: asset.width ?? null,
    height: asset.height ?? null,
    processingStatus: 'ready',
  }
}

export async function preparePostMedia(
  assets: PickedAsset[],
  existingMedia: PostMediaAsset[] = [],
  onProgress?: (progress: MediaProgress) => void
): Promise<PreparedMediaResult> {
  const existingVideos = existingMedia.filter(item => item.type === 'video').length
  const validation = validatePickedPostMedia(assets, existingMedia.length)
  if (validation.error || validation.acceptedMedia.length === 0) {
    return {
      media: existingMedia,
      rejectedCount: validation.rejectedCount,
      error: validation.error,
    }
  }

  const prepared: PostMediaAsset[] = []
  for (const accepted of validation.acceptedMedia) {
    if (accepted.type === 'video' && existingVideos + prepared.filter(item => item.type === 'video').length >= MEDIA_LIMITS.maxPostVideos) {
      continue
    }
    const source = assets.find(asset => asset.uri === accepted.uri) ?? accepted
    prepared.push(
      accepted.type === 'video'
        ? await prepareVideo(source, onProgress)
        : await prepareImage(source, onProgress)
    )
  }
  const next = [...existingMedia, ...prepared].slice(0, MEDIA_LIMITS.maxPostMedia)
  return {
    media: next,
    rejectedCount: validation.rejectedCount + (prepared.length < validation.acceptedMedia.length ? 1 : 0),
    error: null,
  }
}

export async function enqueueServerMediaProcessing(media: PostMediaAsset[]): Promise<void> {
  // The Supabase Edge Function is the durable server-side fallback. Local/demo posts
  // keep this fire-and-forget so creation remains instant when no live upload exists.
  void media
}
