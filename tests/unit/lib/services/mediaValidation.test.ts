import { validatePickedPostMedia } from '@/lib/services/media'
import { preparePostMedia } from '@/lib/services/postMediaProcessing'

// Supabase uses expo-sqlite which is native-only; stub the whole client.
jest.mock('@/lib/supabase', () => ({ supabase: { storage: { from: jest.fn() } } }))

// react-native-compressor is a native module; mock it so we can assert compress is called.
jest.mock('react-native-compressor', () => ({
  Image: { compress: jest.fn(async (uri: string) => uri + '?compressed') },
  Video: { compress: jest.fn(async (uri: string) => uri + '?compressed') },
}), { virtual: true })

// Feature flags: enable compression so shouldCompressImage/Video fires.
jest.mock('@/lib/featureFlags', () => ({
  isEnabled: (flag: string) => flag === 'hybridMediaProcessing' || flag === 'mixedMediaPosts',
}))

const { Image: CompressorImage } = jest.requireMock('react-native-compressor') as {
  Image: { compress: jest.Mock }
  Video: { compress: jest.Mock }
}

function makeImage(overrides?: object) {
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

function makeVideo(overrides?: object) {
  return {
    uri: 'file:///tmp/clip.mp4',
    type: 'video' as const,
    mimeType: 'video/mp4',
    fileSize: 20 * 1024 * 1024,
    duration: 10_000,
    width: 1280,
    height: 720,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// validatePickedPostMedia
// ---------------------------------------------------------------------------

describe('validatePickedPostMedia', () => {
  it('accepts a standard JPEG image', () => {
    const { acceptedMedia, rejectedCount, error } = validatePickedPostMedia([makeImage()], 0)
    expect(error).toBeNull()
    expect(rejectedCount).toBe(0)
    expect(acceptedMedia).toHaveLength(1)
    expect(acceptedMedia[0]?.type).toBe('image')
  })

  it('forwards fileSize, width, and height through to the accepted entry', () => {
    const asset = makeImage({ fileSize: 3_000_000, width: 800, height: 600 })
    const { acceptedMedia } = validatePickedPostMedia([asset], 0)
    const accepted = acceptedMedia[0]
    expect(accepted?.fileSize).toBe(3_000_000)
    expect(accepted?.width).toBe(800)
    expect(accepted?.height).toBe(600)
  })

  it('forwards duration for video entries', () => {
    const asset = makeVideo({ duration: 30_000 })
    const { acceptedMedia } = validatePickedPostMedia([asset], 0)
    expect(acceptedMedia[0]?.duration).toBe(30_000)
  })

  it('rejects an image exceeding maxImageBytes', () => {
    const big = makeImage({ fileSize: 9 * 1024 * 1024 })
    const { acceptedMedia, rejectedCount } = validatePickedPostMedia([big], 0)
    expect(acceptedMedia).toHaveLength(0)
    expect(rejectedCount).toBe(1)
  })

  it('enforces maxPostVideos across multiple calls using existingVideoCount', () => {
    const videos = [makeVideo(), makeVideo()]
    // Already have 3 videos — adding 2 more should reject both.
    const { acceptedMedia, rejectedCount } = validatePickedPostMedia(videos, 3, 3)
    expect(acceptedMedia).toHaveLength(0)
    expect(rejectedCount).toBe(2)
  })

  it('allows videos up to the cap when existingVideoCount is below limit', () => {
    const videos = [makeVideo(), makeVideo()]
    // 1 existing video → can add 2 more to reach max of 3.
    const { acceptedMedia } = validatePickedPostMedia(videos, 1, 1)
    expect(acceptedMedia.filter(m => m.type === 'video')).toHaveLength(2)
  })

  it('returns an error and stops when a video exceeds 100 MB', () => {
    const huge = makeVideo({ fileSize: 101 * 1024 * 1024 })
    const { error } = validatePickedPostMedia([huge], 0)
    expect(error).toMatch(/100 MB/)
  })

  it('returns an error when video duration exceeds 60 seconds', () => {
    const long = makeVideo({ duration: 61_000 })
    const { error } = validatePickedPostMedia([long], 0)
    expect(error).toMatch(/60 seconds/)
  })
})

// ---------------------------------------------------------------------------
// preparePostMedia — metadata preservation and compression trigger
// ---------------------------------------------------------------------------

describe('preparePostMedia', () => {
  beforeEach(() => jest.clearAllMocks())

  it('preserves fileSize, width, height from the original asset in the returned PostMediaAsset', async () => {
    const asset = makeImage({ fileSize: 1_000_000, width: 800, height: 600 })
    const { media } = await preparePostMedia([asset])
    expect(media[0]?.sizeBytes).toBe(1_000_000)
    expect(media[0]?.width).toBe(800)
    expect(media[0]?.height).toBe(600)
  })

  it('triggers image compression when fileSize exceeds 65% of maxImageBytes', async () => {
    const THRESHOLD = 8 * 1024 * 1024 * 0.65 // 65% of 8 MB
    const large = makeImage({ fileSize: Math.ceil(THRESHOLD) + 1 })
    await preparePostMedia([large])
    expect(CompressorImage.compress).toHaveBeenCalledWith(
      large.uri,
      expect.objectContaining({ compressionMethod: 'auto' }),
    )
  })

  it('skips compression when fileSize is below the 65% threshold', async () => {
    const small = makeImage({ fileSize: 100_000 })
    await preparePostMedia([small])
    expect(CompressorImage.compress).not.toHaveBeenCalled()
  })

  it('enforces video count across existing media via existingVideoCount passed to validator', async () => {
    const existingVideos = [
      { localId: 'v1', uri: 'file:///v1.mp4', type: 'video' as const },
      { localId: 'v2', uri: 'file:///v2.mp4', type: 'video' as const },
      { localId: 'v3', uri: 'file:///v3.mp4', type: 'video' as const },
    ]
    const { media } = await preparePostMedia([makeVideo()], existingVideos)
    // No new video should be added; total stays at 3.
    expect(media.filter(m => m.type === 'video')).toHaveLength(3)
  })

  it('returns existing media unchanged when all new assets are rejected', async () => {
    const existing = [{ localId: 'e1', uri: 'file:///existing.jpg', type: 'image' as const }]
    const { media } = await preparePostMedia([makeImage({ fileSize: 9 * 1024 * 1024 })], existing)
    expect(media).toEqual(existing)
  })
})
