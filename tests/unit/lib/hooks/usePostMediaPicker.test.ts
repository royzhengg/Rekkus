import { act, renderHook } from '@testing-library/react-native'
import * as ImagePicker from 'expo-image-picker'
import { PermissionStatus } from 'expo-modules-core'
import { usePostMediaPicker } from '@/lib/hooks/usePostMediaPicker'
import { validatePickedPostMedia } from '@/lib/services/media'
import { preparePostMedia } from '@/lib/services/postMediaProcessing'

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('expo-image-picker', () => ({
  getMediaLibraryPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  getCameraPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}))

jest.mock('@/lib/hooks/usePermissionRecovery', () => ({
  usePermissionRecovery: jest.fn(() => ({
    request: jest.fn(async (fn: () => Promise<{ granted: boolean; canAskAgain: boolean }>) => fn()),
    recoveryVisible: false,
    recoveryMessage: '',
    dismissRecovery: jest.fn(),
    openSettings: jest.fn(),
  })),
}))

jest.mock('@/lib/services/postMediaProcessing', () => ({
  preparePostMedia: jest.fn(),
}))

jest.mock('@/lib/services/media', () => ({
  MEDIA_LIMITS: { maxPostMedia: 10, maxPostVideos: 3, maxPostVideoSeconds: 60, maxImageBytes: 8 * 1024 * 1024, maxPostVideoBytes: 100 * 1024 * 1024 },
  validatePickedPostMedia: jest.fn(),
}))

jest.mock('@/lib/featureFlags', () => ({
  isEnabled: jest.fn(() => false),
}))

jest.mock('@/lib/analytics', () => ({
  analytics: {
    mediaEvent: jest.fn(),
    uploadFailure: jest.fn(),
  },
}))

// ── Typed mock accessors ───────────────────────────────────────────────────

const mockGetLibraryPerms = jest.mocked(ImagePicker.getMediaLibraryPermissionsAsync)
const mockGetCameraPerms = jest.mocked(ImagePicker.getCameraPermissionsAsync)
const mockLaunchLibrary = jest.mocked(ImagePicker.launchImageLibraryAsync)
const mockLaunchCamera = jest.mocked(ImagePicker.launchCameraAsync)
const mockPreparePostMedia = jest.mocked(preparePostMedia)
const mockValidatePickedPostMedia = jest.mocked(validatePickedPostMedia)

// ── Fixtures ───────────────────────────────────────────────────────────────

const GRANTED = { granted: true, canAskAgain: true, status: PermissionStatus.GRANTED, expires: 'never' as const }
const DENIED = { granted: false, canAskAgain: false, status: PermissionStatus.DENIED, expires: 'never' as const }

function makePickedAsset(overrides?: object) {
  return {
    uri: 'file:///tmp/photo.jpeg',
    type: 'image' as const,
    mimeType: 'image/jpeg',
    fileSize: 2 * 1024 * 1024,
    width: 1920,
    height: 1080,
    ...overrides,
  }
}

function makePreparedMedia(overrides?: object) {
  return {
    localId: 'media-abc',
    uri: 'file:///tmp/photo.jpeg',
    type: 'image' as const,
    processingStatus: 'ready' as const,
    mimeType: 'image/jpeg',
    sizeBytes: 2 * 1024 * 1024,
    width: 1920,
    height: 1080,
    ...overrides,
  }
}

function makeLibraryResult(assets = [makePickedAsset()]) {
  return { canceled: false, assets } as ImagePicker.ImagePickerResult
}

function makeCanceledResult(): ImagePicker.ImagePickerResult {
  return { canceled: true, assets: null } as unknown as ImagePicker.ImagePickerResult
}

// ── Helpers ────────────────────────────────────────────────────────────────

function hookOptions(overrides?: object) {
  return {
    existingMedia: [],
    onResult: jest.fn(),
    onError: jest.fn(),
    onExifCoords: jest.fn(),
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('usePostMediaPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetLibraryPerms.mockResolvedValue(GRANTED)
    mockGetCameraPerms.mockResolvedValue(GRANTED)
  })

  // ── pickFromLibrary ──────────────────────────────────────────────────────

  describe('pickFromLibrary', () => {
    it('calls onResult with prepared media on a successful pick', async () => {
      const prepared = makePreparedMedia()
      mockLaunchLibrary.mockResolvedValue(makeLibraryResult())
      mockPreparePostMedia.mockResolvedValue({ media: [prepared], rejectedCount: 0, error: null })

      const opts = hookOptions()
      const { result } = renderHook(() => usePostMediaPicker(opts))

      await act(async () => { await result.current.pickFromLibrary() })

      expect(opts.onResult).toHaveBeenCalledWith([prepared])
      expect(opts.onError).not.toHaveBeenCalled()
    })

    it('calls onError and does not crash when permission is permanently denied', async () => {
      mockGetLibraryPerms.mockResolvedValue(DENIED)

      const opts = hookOptions()
      const { result } = renderHook(() => usePostMediaPicker(opts))

      await act(async () => { await result.current.pickFromLibrary() })

      expect(opts.onResult).not.toHaveBeenCalled()
      expect(mockLaunchLibrary).not.toHaveBeenCalled()
    })

    it('calls onError when the picker throws', async () => {
      mockLaunchLibrary.mockRejectedValue(new Error('native crash'))

      const opts = hookOptions()
      const { result } = renderHook(() => usePostMediaPicker(opts))

      await act(async () => { await result.current.pickFromLibrary() })

      expect(opts.onError).toHaveBeenCalledWith(expect.stringContaining('try again'))
      expect(opts.onResult).not.toHaveBeenCalled()
    })

    it('calls onError when preparePostMedia returns a validation error', async () => {
      mockLaunchLibrary.mockResolvedValue(makeLibraryResult())
      mockPreparePostMedia.mockResolvedValue({
        media: [],
        rejectedCount: 1,
        error: 'Video exceeds 100 MB limit.',
      })

      const opts = hookOptions()
      const { result } = renderHook(() => usePostMediaPicker(opts))

      await act(async () => { await result.current.pickFromLibrary() })

      expect(opts.onError).toHaveBeenCalledWith('Video exceeds 100 MB limit.')
    })

    it('does not open the picker when media slots are full', async () => {
      const fullMedia = Array.from({ length: 10 }, (_, i) => makePreparedMedia({ localId: `m${i}` }))

      const opts = hookOptions({ existingMedia: fullMedia })
      const { result } = renderHook(() => usePostMediaPicker(opts))

      await act(async () => { await result.current.pickFromLibrary() })

      expect(mockLaunchLibrary).not.toHaveBeenCalled()
      expect(opts.onResult).not.toHaveBeenCalled()
    })

    it('passes selectionLimit = remaining slots to launchImageLibraryAsync', async () => {
      const existing = [makePreparedMedia()]
      mockLaunchLibrary.mockResolvedValue(makeLibraryResult())
      mockPreparePostMedia.mockResolvedValue({ media: [makePreparedMedia(), makePreparedMedia()], rejectedCount: 0, error: null })

      const opts = hookOptions({ existingMedia: existing })
      const { result } = renderHook(() => usePostMediaPicker(opts))

      await act(async () => { await result.current.pickFromLibrary() })

      expect(mockLaunchLibrary).toHaveBeenCalledWith(
        expect.objectContaining({ selectionLimit: 9 })
      )
    })

    it('does nothing when the user cancels the picker', async () => {
      mockLaunchLibrary.mockResolvedValue(makeCanceledResult())

      const opts = hookOptions()
      const { result } = renderHook(() => usePostMediaPicker(opts))

      await act(async () => { await result.current.pickFromLibrary() })

      expect(opts.onResult).not.toHaveBeenCalled()
      expect(opts.onError).not.toHaveBeenCalled()
    })

    it('extracts EXIF coords from the first asset and calls onExifCoords', async () => {
      const assetWithExif = {
        ...makePickedAsset(),
        exif: { GPSLatitude: 40.7128, GPSLongitude: 74.006, GPSLatitudeRef: 'N', GPSLongitudeRef: 'W' },
      }
      mockLaunchLibrary.mockResolvedValue({ canceled: false, assets: [assetWithExif] } as unknown as ImagePicker.ImagePickerResult)
      mockPreparePostMedia.mockResolvedValue({ media: [makePreparedMedia()], rejectedCount: 0, error: null })

      const opts = hookOptions()
      const { result } = renderHook(() => usePostMediaPicker(opts))

      await act(async () => { await result.current.pickFromLibrary() })

      expect(opts.onExifCoords).toHaveBeenCalledWith({ lat: 40.7128, lng: -74.006 })
    })
  })

  // ── pickFromCamera ───────────────────────────────────────────────────────

  describe('pickFromCamera', () => {
    it('calls onResult with prepared media on a successful capture', async () => {
      const prepared = makePreparedMedia()
      mockLaunchCamera.mockResolvedValue(makeLibraryResult())
      mockPreparePostMedia.mockResolvedValue({ media: [prepared], rejectedCount: 0, error: null })

      const opts = hookOptions()
      const { result } = renderHook(() => usePostMediaPicker(opts))

      await act(async () => { await result.current.pickFromCamera() })

      expect(opts.onResult).toHaveBeenCalledWith([prepared])
      expect(opts.onError).not.toHaveBeenCalled()
    })

    it('calls onError when camera permission is permanently denied', async () => {
      mockGetCameraPerms.mockResolvedValue(DENIED)

      const opts = hookOptions()
      const { result } = renderHook(() => usePostMediaPicker(opts))

      await act(async () => { await result.current.pickFromCamera() })

      expect(mockLaunchCamera).not.toHaveBeenCalled()
      expect(opts.onResult).not.toHaveBeenCalled()
    })

    it('calls onError when the camera throws', async () => {
      mockLaunchCamera.mockRejectedValue(new Error('camera unavailable'))

      const opts = hookOptions()
      const { result } = renderHook(() => usePostMediaPicker(opts))

      await act(async () => { await result.current.pickFromCamera() })

      expect(opts.onError).toHaveBeenCalled()
    })
  })

  // ── replaceCover ─────────────────────────────────────────────────────────

  describe('replaceCover', () => {
    it('replaces the first image in existingMedia with the picked cover', async () => {
      const existing = [makePreparedMedia({ localId: 'orig-1', uri: 'file:///old.jpg' })]
      const pickedAsset = makePickedAsset({ uri: 'file:///new-cover.jpg' })
      mockLaunchLibrary.mockResolvedValue({ canceled: false, assets: [pickedAsset] } as unknown as ImagePicker.ImagePickerResult)
      mockValidatePickedPostMedia.mockReturnValue({
        acceptedMedia: [{ uri: pickedAsset.uri, type: 'image', mimeType: 'image/jpeg' }],
        rejectedCount: 0,
        error: null,
      })

      const opts = hookOptions({ existingMedia: existing })
      const { result } = renderHook(() => usePostMediaPicker(opts))

      await act(async () => { await result.current.replaceCover() })

      expect(opts.onResult).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ localId: 'orig-1', uri: pickedAsset.uri }),
        ])
      )
    })

    it('does nothing when the user cancels the cover picker', async () => {
      mockLaunchLibrary.mockResolvedValue(makeCanceledResult())

      const opts = hookOptions({ existingMedia: [makePreparedMedia()] })
      const { result } = renderHook(() => usePostMediaPicker(opts))

      await act(async () => { await result.current.replaceCover() })

      expect(opts.onResult).not.toHaveBeenCalled()
    })
  })

  // ── Concurrent guard ─────────────────────────────────────────────────────

  describe('concurrent guard', () => {
    it('ignores a second pickFromLibrary call while the first is still in flight', async () => {
      let resolveFirst!: (r: ImagePicker.ImagePickerResult) => void
      const firstPick = new Promise<ImagePicker.ImagePickerResult>(resolve => { resolveFirst = resolve })
      mockLaunchLibrary
        .mockReturnValueOnce(firstPick)
        .mockResolvedValue(makeLibraryResult())

      const opts = hookOptions()
      const { result } = renderHook(() => usePostMediaPicker(opts))

      const first = act(async () => { await result.current.pickFromLibrary() })
      await act(async () => { await result.current.pickFromLibrary() })

      resolveFirst(makeCanceledResult())
      await first

      expect(mockLaunchLibrary).toHaveBeenCalledTimes(1)
    })
  })
})
