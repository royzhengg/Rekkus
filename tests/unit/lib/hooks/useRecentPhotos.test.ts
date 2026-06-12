import { act, renderHook, waitFor } from '@testing-library/react-native'
import * as MediaLibrary from 'expo-media-library'
import { PermissionStatus } from 'expo-modules-core'
import { useRecentPhotos } from '@/lib/hooks/useRecentPhotos'

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  getAssetsAsync: jest.fn(),
  MediaType: { photo: 'photo' },
  SortBy: { creationTime: 'creationTime' },
}))

const mockGetPermissionsAsync = jest.mocked(MediaLibrary.getPermissionsAsync)
const mockRequestPermissionsAsync = jest.mocked(MediaLibrary.requestPermissionsAsync)
const mockGetAssetsAsync = jest.mocked(MediaLibrary.getAssetsAsync)

function deferred<T>() {
  let complete: ((value: T) => void) | undefined
  let fail: ((reason?: unknown) => void) | undefined
  const promise = new Promise<T>((resolve, reject) => {
    complete = resolve
    fail = reject
  })
  return {
    promise,
    resolve(value: T) {
      complete?.(value)
    },
    reject(reason?: unknown) {
      fail?.(reason)
    },
  }
}

function asset(index: number): MediaLibrary.Asset {
  return {
    id: `asset-${index}`,
    filename: `photo-${index}.jpg`,
    uri: `file:///photo-${index}.jpg`,
    mediaType: 'photo',
    width: 800,
    height: 600,
    creationTime: 1000 - index,
    modificationTime: 1000 - index,
    duration: 0,
  }
}

function page(assets: MediaLibrary.Asset[]): MediaLibrary.PagedInfo<MediaLibrary.Asset> {
  return {
    assets,
    endCursor: assets.at(-1)?.id ?? '',
    hasNextPage: false,
    totalCount: assets.length,
  }
}

describe('useRecentPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('loads recent photos when photo permission is already granted', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true, status: PermissionStatus.GRANTED, expires: 'never' })
    mockGetAssetsAsync.mockResolvedValue(page([asset(0), asset(1)]))

    const { result } = renderHook(() => useRecentPhotos({ enabled: true }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled()
    expect(mockGetAssetsAsync).toHaveBeenCalledWith({
      first: 5,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [MediaLibrary.SortBy.creationTime],
      resolveWithFullInfo: true,
    })
    expect(result.current.photos).toEqual([
      { id: 'asset-0', uri: 'file:///photo-0.jpg', width: 800, height: 600, filename: 'photo-0.jpg' },
      { id: 'asset-1', uri: 'file:///photo-1.jpg', width: 800, height: 600, filename: 'photo-1.jpg' },
    ])
    expect(result.current.denied).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('does not request permission or fetch assets when permission is undetermined', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true, status: PermissionStatus.UNDETERMINED, expires: 'never' })

    const { result } = renderHook(() => useRecentPhotos({ enabled: true }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled()
    expect(result.current.denied).toBe(true)
    expect(result.current.photos).toEqual([])
    expect(mockGetAssetsAsync).not.toHaveBeenCalled()
  })

  it('does not request permission or fetch assets when permission is denied', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false, status: PermissionStatus.DENIED, expires: 'never' })

    const { result } = renderHook(() => useRecentPhotos({ enabled: true }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled()
    expect(result.current.denied).toBe(true)
    expect(result.current.photos).toEqual([])
    expect(mockGetAssetsAsync).not.toHaveBeenCalled()
  })

  it('returns empty photos for an empty library result', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true, status: PermissionStatus.GRANTED, expires: 'never' })
    mockGetAssetsAsync.mockResolvedValue(page([]))

    const { result } = renderHook(() => useRecentPhotos({ enabled: true }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.photos).toEqual([])
    expect(result.current.denied).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('captures fetch failures without throwing', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true, status: PermissionStatus.GRANTED, expires: 'never' })
    mockGetAssetsAsync.mockRejectedValue(new Error('Native library unavailable'))

    const { result } = renderHook(() => useRecentPhotos({ enabled: true }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.photos).toEqual([])
    expect(result.current.error).toBe('Native library unavailable')
  })

  it('does not request permission while disabled', () => {
    const { result } = renderHook(() => useRecentPhotos({ enabled: false }))

    expect(mockGetPermissionsAsync).not.toHaveBeenCalled()
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled()
    expect(result.current).toEqual({ photos: [], loading: false, denied: false, error: null })
  })

  it('does not publish a stale result after being disabled', async () => {
    const pending = deferred<MediaLibrary.PagedInfo<MediaLibrary.Asset>>()
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true, status: PermissionStatus.GRANTED, expires: 'never' })
    mockGetAssetsAsync.mockReturnValue(pending.promise)

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useRecentPhotos({ enabled }),
      { initialProps: { enabled: true } }
    )

    rerender({ enabled: false })
    await act(async () => {
      pending.resolve(page([asset(0)]))
      await Promise.resolve()
    })

    expect(result.current).toEqual({ photos: [], loading: false, denied: false, error: null })
  })
})
