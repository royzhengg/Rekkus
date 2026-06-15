// react-native-compressor is a native module unavailable in Expo Go / unlinked builds.
// Dynamic require + try-catch is intentional — do NOT convert to a static import.
type CompressorImageModule = {
  compress: (
    uri: string,
    options: { compressionMethod: 'auto'; maxWidth: number; maxHeight: number; quality: number }
  ) => Promise<string>
}

type CompressorVideoModule = {
  compress: (
    uri: string,
    options: {
      compressionMethod: 'manual'
      maxSize: number
      bitrate: number
      minimumFileSizeForCompress: number
    },
    onProgress?: (progress: number) => void
  ) => Promise<string>
}

type CompressorModule = {
  Image?: CompressorImageModule
  Video?: CompressorVideoModule
}

function isCompressorModule(value: unknown): value is CompressorModule {
  return typeof value === 'object' && value !== null
}

let CompressorImage: CompressorImageModule | null = null
let CompressorVideo: CompressorVideoModule | null = null
try {
  const mod: unknown = require('react-native-compressor')
  if (!isCompressorModule(mod)) throw new Error('Invalid compressor module')
  CompressorImage = mod.Image ?? null
  CompressorVideo = mod.Video ?? null
} catch {
  // Not linked — Expo Go or dev build without native module; compression skipped
}
import { isEnabled } from '@/lib/featureFlags'
import { MEDIA_LIMITS, validatePickedPostMedia } from '@/lib/services/media'
import type { ValidatedPostMedia } from '@/lib/services/media'
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

type PreparedAsset = ValidatedPostMedia & PickedAsset

export type PreparedMediaResult = {
  media: PostMediaAsset[]
  rejectedCount: number
  error?: string | null | undefined
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

async function prepareImage(asset: PreparedAsset, onProgress?: (progress: MediaProgress) => void): Promise<PostMediaAsset> {
  const id = localId()
  onProgress?.({ localId: id, status: 'preparing', progress: 0.15 })
  let uri = asset.uri
  try {
    if (CompressorImage && shouldCompressImage(asset) && isEnabled('hybridMediaProcessing')) {
      uri = await CompressorImage.compress(uri, {
        compressionMethod: 'auto',
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.82,
      })
    }
  } catch {
    uri = asset.uri
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

async function prepareVideo(asset: PreparedAsset, onProgress?: (progress: MediaProgress) => void): Promise<PostMediaAsset> {
  const id = localId()
  onProgress?.({ localId: id, status: 'preparing', progress: 0.05 })
  let uri = asset.uri
  try {
    if (CompressorVideo && shouldCompressVideo(asset) && isEnabled('hybridMediaProcessing')) {
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
  } catch (e) {
    if (asset.fileSize && asset.fileSize > MEDIA_LIMITS.maxPostVideoBytes) {
      return {
        localId: id,
        uri: asset.uri,
        type: 'video',
        mimeType: asset.mimeType ?? null,
        sizeBytes: asset.fileSize ?? null,
        durationMs: asset.duration ?? null,
        width: asset.width ?? null,
        height: asset.height ?? null,
        processingStatus: 'failed',
        processingError: e instanceof Error ? e.message : 'Video compression failed.',
      }
    }
    uri = asset.uri
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
  const validation = validatePickedPostMedia(assets, existingMedia.length, existingVideos)
  if (validation.error || validation.acceptedMedia.length === 0) {
    return {
      media: existingMedia,
      rejectedCount: validation.rejectedCount,
      error: validation.error ?? null,
    }
  }

  const prepared: PostMediaAsset[] = []
  for (const accepted of validation.acceptedMedia) {
    prepared.push(
      accepted.type === 'video'
        ? await prepareVideo(accepted, onProgress)
        : await prepareImage(accepted, onProgress)
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
