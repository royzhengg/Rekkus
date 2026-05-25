import * as Crypto from 'expo-crypto'
import * as FileSystem from 'expo-file-system'
import { supabase } from '@/lib/supabase'

const BUCKET = 'message-attachments'

const SIZE_LIMITS: Record<string, number> = {
  'image/jpeg': 10 * 1024 * 1024,
  'image/png': 10 * 1024 * 1024,
  'image/webp': 10 * 1024 * 1024,
  'image/heic': 10 * 1024 * 1024,
  'image/heif': 10 * 1024 * 1024,
  'video/mp4': 100 * 1024 * 1024,
  'video/quicktime': 100 * 1024 * 1024,
  'video/x-m4v': 100 * 1024 * 1024,
  'audio/m4a': 25 * 1024 * 1024,
  'audio/mp4': 25 * 1024 * 1024,
  'audio/mpeg': 25 * 1024 * 1024,
}

const ALLOWED_TYPES = new Set(Object.keys(SIZE_LIMITS))

// Hashes the first 64 KB of the file for CSAM blocklist checking in the moderate-content Edge Function.
export async function computeFileHash(uri: string): Promise<string> {
  const chunk = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64' as const,
    length: 65536,
    position: 0,
  })
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, chunk)
}

export async function uploadAttachment(
  conversationId: string,
  senderId: string,
  uri: string,
  mimeType: string
): Promise<{ url: string; hash: string; error: string | null }> {
  if (!ALLOWED_TYPES.has(mimeType)) {
    return { url: '', hash: '', error: 'File type not supported.' }
  }

  const info = await FileSystem.getInfoAsync(uri)
  if (!info.exists) {
    return { url: '', hash: '', error: 'File not found.' }
  }

  const limit = SIZE_LIMITS[mimeType] ?? 50 * 1024 * 1024
  if ('size' in info && info.size && info.size > limit) {
    const limitMb = Math.round(limit / 1024 / 1024)
    return { url: '', hash: '', error: `File exceeds the ${limitMb} MB limit.` }
  }

  const hash = await computeFileHash(uri)

  const ext = uri.split('.').pop() ?? 'bin'
  const timestamp = Date.now()
  const storagePath = `${conversationId}/${senderId}/${timestamp}.${ext}`

  const fileContent = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as const })

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, decode(fileContent), {
      contentType: mimeType,
      upsert: false,
    })

  if (uploadError) {
    return { url: '', hash, error: 'Upload failed. Please try again.' }
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

  return { url: publicUrl, hash, error: null }
}

export async function deleteAttachment(url: string): Promise<void> {
  try {
    // Extract path from URL: everything after /object/public/{bucket}/
    const marker = `/object/public/${BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx === -1) return
    const storagePath = url.slice(idx + marker.length)
    await supabase.storage.from(BUCKET).remove([storagePath])
  } catch {
    // Best-effort deletion; cron job will sweep orphaned files
  }
}

// base64 → Uint8Array (needed for Supabase Storage upload)
function decode(base64: string): Uint8Array {
  const binaryStr = atob(base64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return bytes
}
