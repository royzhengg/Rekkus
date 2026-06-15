import * as FileSystem from 'expo-file-system'
import { supabase } from '@/lib/supabase'
import type { PostMediaAsset } from '@/types/domain'

const POST_MEDIA_BUCKET = 'post-media'
const DRAFT_BUCKET = 'post-drafts'

function isRemoteUri(uri: string): boolean {
  return /^https?:\/\//i.test(uri)
}

function extForMedia(media: PostMediaAsset): string {
  const raw = media.uri.split('?')[0]?.split('.').pop()?.toLowerCase()
  if (raw && /^[a-z0-9]+$/.test(raw) && raw.length <= 5) return raw
  if (media.type === 'video') return 'mp4'
  if (media.mimeType?.includes('png')) return 'png'
  if (media.mimeType?.includes('webp')) return 'webp'
  if (media.mimeType?.includes('heic')) return 'heic'
  return 'jpg'
}

function mimeForMedia(media: PostMediaAsset): string {
  if (media.mimeType) return media.mimeType
  if (media.type === 'video') return 'video/mp4'
  const ext = extForMedia(media)
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'heic') return 'image/heic'
  if (ext === 'heif') return 'image/heif'
  return 'image/jpeg'
}

function decode(base64: string): Uint8Array {
  const binaryStr = atob(base64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return bytes
}

async function uploadOne(
  bucket: string,
  storagePath: string,
  uri: string,
  media: PostMediaAsset,
): Promise<string> {
  const fileContent = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as const })
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, decode(fileContent), { contentType: mimeForMedia(media), upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath)
  return data.publicUrl
}

export async function uploadPostMedia(userId: string, media: PostMediaAsset[]): Promise<PostMediaAsset[]> {
  const result: PostMediaAsset[] = []
  for (const item of media) {
    if (isRemoteUri(item.processedUrl ?? item.uri)) {
      result.push(item)
      continue
    }
    const ext = extForMedia(item)
    const storagePath = `${userId}/${item.localId}.${ext}`
    const publicUrl = await uploadOne(POST_MEDIA_BUCKET, storagePath, item.processedUrl ?? item.uri, item)
    result.push({ ...item, originalUrl: item.originalUrl ?? item.uri, processedUrl: publicUrl })
  }
  return result
}

export async function uploadDraftMedia(
  userId: string,
  draftId: string,
  media: PostMediaAsset[],
): Promise<PostMediaAsset[]> {
  const uploaded: PostMediaAsset[] = []
  for (let i = 0; i < media.length; i++) {
    const item = media[i]
    if (!item) continue
    if (item.storagePath || isRemoteUri(item.uri)) {
      uploaded.push(item)
      continue
    }
    const info = await FileSystem.getInfoAsync(item.uri)
    if (!info.exists) throw new Error('Draft media file was not found on this device.')
    const ext = extForMedia(item)
    const storagePath = `${userId}/${draftId}/${item.localId || `media-${i}`}.${ext}`
    const publicUrl = await uploadOne(DRAFT_BUCKET, storagePath, item.uri, item)
    uploaded.push({ ...item, storagePath, processedUrl: publicUrl })
  }
  return uploaded
}
