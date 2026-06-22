import * as ImagePicker from 'expo-image-picker'
import { useRef } from 'react'
import { analytics } from '@/lib/analytics'
import { isEnabled } from '@/lib/featureFlags'
import { usePermissionRecovery } from '@/lib/hooks/usePermissionRecovery'
import { MEDIA_LIMITS, validatePickedPostMedia } from '@/lib/services/media'
import { preparePostMedia } from '@/lib/services/postMediaProcessing'
import type { PostMedia } from '@/types/domain'

const PHOTO_LIBRARY_DENIED_MESSAGE =
  'Media library access is needed to add media. Enable it in Settings.'
const CAMERA_DENIED_MESSAGE =
  'Camera access is needed to take a food photo. Enable it in Settings.'
const PHOTO_LIBRARY_OPEN_ERROR = 'Could not open your media library. Please try again.'
const CAMERA_OPEN_ERROR = 'Could not open your camera. Please try again.'

// ── Permission helpers ─────────────────────────────────────────────────────

async function requestMediaLibraryPermission(
  request: ReturnType<typeof usePermissionRecovery>['request']
): Promise<boolean> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync()
  if (current.granted) return true
  if (!current.canAskAgain) {
    await request(() => Promise.resolve(current), PHOTO_LIBRARY_DENIED_MESSAGE)
    return false
  }
  const result = await request(
    () => ImagePicker.requestMediaLibraryPermissionsAsync(),
    PHOTO_LIBRARY_DENIED_MESSAGE
  )
  return result.granted
}

async function requestCameraPermission(
  request: ReturnType<typeof usePermissionRecovery>['request']
): Promise<boolean> {
  const current = await ImagePicker.getCameraPermissionsAsync()
  if (current.granted) return true
  if (!current.canAskAgain) {
    await request(() => Promise.resolve(current), CAMERA_DENIED_MESSAGE)
    return false
  }
  const result = await request(
    () => ImagePicker.requestCameraPermissionsAsync(),
    CAMERA_DENIED_MESSAGE
  )
  return result.granted
}

// ── EXIF normalisation ─────────────────────────────────────────────────────

export function normaliseExifCoords(
  lat: number | undefined,
  lng: number | undefined,
  latRef: string | undefined,
  lngRef: string | undefined
): { lat: number; lng: number } | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  return {
    lat: latRef === 'S' ? -Math.abs(lat) : Math.abs(lat),
    lng: lngRef === 'W' ? -Math.abs(lng) : Math.abs(lng),
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────

type Options = {
  existingMedia: PostMedia[]
  onResult: (media: PostMedia[]) => void
  onError: (message: string) => void
  onExifCoords?: ((coords: { lat: number; lng: number }) => void) | undefined
}

export function usePostMediaPicker({ existingMedia, onResult, onError, onExifCoords }: Options) {
  const pickerActiveRef = useRef(false)
  const { request, recoveryVisible, recoveryMessage, dismissRecovery, openSettings } =
    usePermissionRecovery()

  async function pickFromLibrary(): Promise<void> {
    if (pickerActiveRef.current) return
    const remaining = MEDIA_LIMITS.maxPostMedia - existingMedia.length
    if (remaining <= 0) return
    pickerActiveRef.current = true
    try {
      const permitted = await requestMediaLibraryPermission(request)
      if (!permitted) return
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: isEnabled('mixedMediaPosts') ? ['images', 'videos'] : ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: remaining,
        videoMaxDuration: MEDIA_LIMITS.maxPostVideoSeconds,
        exif: true,
      })
      if (result.canceled) return

      if (onExifCoords) {
        const exif = result.assets[0]?.exif as Record<string, unknown> | undefined
        const coords = normaliseExifCoords(
          exif?.GPSLatitude as number | undefined,
          exif?.GPSLongitude as number | undefined,
          exif?.GPSLatitudeRef as string | undefined,
          exif?.GPSLongitudeRef as string | undefined
        )
        if (coords) onExifCoords(coords)
      }

      analytics.mediaEvent(null, 'media_selected', 'post_create', { media_count: result.assets.length })
      analytics.mediaEvent(null, 'media_prepare_started', 'post_create', { media_count: result.assets.length })

      const { media: nextMedia, rejectedCount, error } = await preparePostMedia(
        result.assets,
        existingMedia
      )
      if (error) {
        onError(error)
      } else if (rejectedCount > 0 && nextMedia.length === existingMedia.length) {
        onError('Could not add the selected media. Check the file type and size.')
      }
      if (rejectedCount > 0) {
        analytics.uploadFailure(null, 'post_media_picker', 'validation_rejected', rejectedCount)
        analytics.mediaEvent(null, 'media_prepare_failed', 'post_create', {
          reason: error ?? 'validation_rejected',
        })
      }
      if (nextMedia.length > existingMedia.length) {
        onResult(nextMedia)
        analytics.mediaEvent(null, 'media_prepare_completed', 'post_create', {
          media_count: nextMedia.length - existingMedia.length,
        })
      }
    } catch (e) {
      onError(PHOTO_LIBRARY_OPEN_ERROR)
      analytics.uploadFailure(null, 'post_media_picker', 'picker_unavailable')
      analytics.mediaEvent(null, 'media_prepare_failed', 'post_create', {
        reason: e instanceof Error ? e.message : 'picker_unavailable',
      })
    } finally {
      pickerActiveRef.current = false
    }
  }

  async function pickFromCamera(): Promise<void> {
    if (pickerActiveRef.current) return
    pickerActiveRef.current = true
    try {
      const permitted = await requestCameraPermission(request)
      if (!permitted) return
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: false,
      })
      if (result.canceled) return

      analytics.mediaEvent(null, 'media_selected', 'post_create', {
        media_count: result.assets.length,
        media_type: 'image',
      })
      analytics.mediaEvent(null, 'media_prepare_started', 'post_create', {
        media_count: result.assets.length,
        media_type: 'image',
      })

      const { media: nextMedia, rejectedCount, error } = await preparePostMedia(
        result.assets,
        existingMedia
      )
      if (error) onError(error)
      if (rejectedCount > 0) {
        analytics.uploadFailure(null, 'post_camera', 'validation_rejected', rejectedCount)
        analytics.mediaEvent(null, 'media_prepare_failed', 'post_create', {
          reason: error ?? 'validation_rejected',
          media_type: 'image',
        })
      }
      if (nextMedia.length > existingMedia.length) {
        onResult(nextMedia)
        analytics.mediaEvent(null, 'media_prepare_completed', 'post_create', {
          media_count: nextMedia.length - existingMedia.length,
          media_type: 'image',
        })
      }
    } catch (e) {
      onError(CAMERA_OPEN_ERROR)
      analytics.uploadFailure(null, 'post_camera', 'picker_unavailable')
      analytics.mediaEvent(null, 'media_prepare_failed', 'post_create', {
        reason: e instanceof Error ? e.message : 'picker_unavailable',
        media_type: 'image',
      })
    } finally {
      pickerActiveRef.current = false
    }
  }

  async function replaceCover(): Promise<void> {
    if (pickerActiveRef.current) return
    pickerActiveRef.current = true
    try {
      const permitted = await requestMediaLibraryPermission(request)
      if (!permitted) return
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.9,
      })
      if (result.canceled || !result.assets[0]) return

      const { acceptedMedia, rejectedCount } = validatePickedPostMedia(result.assets, 0)
      if (!acceptedMedia[0] || acceptedMedia[0].type !== 'image') {
        analytics.uploadFailure(null, 'post_cover_picker', 'validation_rejected', rejectedCount || 1)
        return
      }

      const firstImageIndex = existingMedia.findIndex(item => item.type === 'image')
      if (firstImageIndex >= 0) {
        const currentImage = existingMedia[firstImageIndex]
        if (!currentImage) return
        const next = [...existingMedia]
        next[firstImageIndex] = {
          ...currentImage,
          uri: acceptedMedia[0].uri,
          mimeType: acceptedMedia[0].mimeType,
          processedUrl: acceptedMedia[0].uri,
          originalUrl: acceptedMedia[0].uri,
        }
        onResult(next)
      } else {
        const newCover: PostMedia = {
          localId: `media-${Date.now()}`,
          uri: acceptedMedia[0].uri,
          type: 'image',
          mimeType: acceptedMedia[0].mimeType,
          processingStatus: 'ready',
        }
        onResult([newCover, ...existingMedia])
      }
    } catch {
      onError(PHOTO_LIBRARY_OPEN_ERROR)
    } finally {
      pickerActiveRef.current = false
    }
  }

  return {
    pickFromLibrary,
    pickFromCamera,
    replaceCover,
    recoveryVisible,
    recoveryMessage,
    dismissRecovery,
    openSettings,
  }
}
