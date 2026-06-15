import * as FileSystem from 'expo-file-system'
import { uploadDraftMedia, uploadPostMedia } from '@/lib/services/postMedia'
import { supabase } from '@/lib/supabase'
import type { PostMediaAsset } from '@/types/domain'

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  getInfoAsync: jest.fn(),
}))

jest.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: jest.fn() } },
}))

const mockReadAsStringAsync = jest.mocked(FileSystem.readAsStringAsync)
const mockGetInfoAsync = jest.mocked(FileSystem.getInfoAsync)
const mockStorageFrom = jest.mocked(supabase.storage.from)

function makeStorageMock(publicUrl = 'https://cdn.example.com/file.jpg') {
  const upload = jest.fn().mockResolvedValue({ error: null })
  const getPublicUrl = jest.fn().mockReturnValue({ data: { publicUrl } })
  const createSignedUrl = jest.fn().mockResolvedValue({ data: { signedUrl: publicUrl }, error: null })
  mockStorageFrom.mockReturnValue({ upload, getPublicUrl, createSignedUrl } as never)
  return { upload, getPublicUrl }
}

function localAsset(overrides?: Partial<PostMediaAsset>): PostMediaAsset {
  return {
    localId: 'asset-1',
    uri: 'file:///tmp/photo.jpg',
    type: 'image',
    width: 800,
    height: 600,
    ...overrides,
  }
}

describe('uploadPostMedia', () => {
  beforeEach(() => jest.clearAllMocks())

  it('skips items that already have a remote URI', async () => {
    const remote = localAsset({ uri: 'https://cdn.example.com/already.jpg' })
    const { upload } = makeStorageMock()

    const result = await uploadPostMedia('user-1', [remote])

    expect(upload).not.toHaveBeenCalled()
    expect(result[0]).toEqual(remote)
  })

  it('uploads a local file and returns the public URL as processedUrl', async () => {
    mockReadAsStringAsync.mockResolvedValue('base64data==')
    const { upload, getPublicUrl } = makeStorageMock('https://cdn.example.com/user-1/asset-1.jpg')

    const result = await uploadPostMedia('user-1', [localAsset()])

    expect(upload).toHaveBeenCalledWith(
      'user-1/asset-1.jpg',
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: 'image/jpeg', upsert: true }),
    )
    expect(getPublicUrl).toHaveBeenCalledWith('user-1/asset-1.jpg')
    expect(result[0]?.processedUrl).toBe('https://cdn.example.com/user-1/asset-1.jpg')
  })

  it('uses the post-media bucket (not the draft bucket)', async () => {
    mockReadAsStringAsync.mockResolvedValue('base64data==')
    makeStorageMock()

    await uploadPostMedia('user-1', [localAsset()])

    expect(mockStorageFrom).toHaveBeenCalledWith('post-media')
    expect(mockStorageFrom).not.toHaveBeenCalledWith('post-drafts')
  })
})

describe('uploadDraftMedia', () => {
  beforeEach(() => jest.clearAllMocks())

  it('skips items that already have a storagePath', async () => {
    const alreadyStored = localAsset({ storagePath: 'user-1/draft-a/asset-1.jpg' })
    const { upload } = makeStorageMock()

    const result = await uploadDraftMedia('user-1', 'draft-a', [alreadyStored])

    expect(upload).not.toHaveBeenCalled()
    expect(result[0]).toEqual(alreadyStored)
  })

  it('skips items with a remote URI', async () => {
    const remote = localAsset({ uri: 'https://cdn.example.com/already.jpg' })
    const { upload } = makeStorageMock()

    await uploadDraftMedia('user-1', 'draft-a', [remote])

    expect(upload).not.toHaveBeenCalled()
  })

  it('uploads a local file to the draft bucket with a draft-scoped path', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: true, isDirectory: false, uri: 'file:///tmp/photo.jpg' } as Awaited<ReturnType<typeof FileSystem.getInfoAsync>>)
    mockReadAsStringAsync.mockResolvedValue('base64data==')
    const { upload } = makeStorageMock()

    await uploadDraftMedia('user-1', 'draft-a', [localAsset()])

    expect(mockStorageFrom).toHaveBeenCalledWith('post-drafts')
    expect(upload).toHaveBeenCalledWith(
      'user-1/draft-a/asset-1.jpg',
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: 'image/jpeg', upsert: true }),
    )
  })

  it('throws when the local file does not exist on disk', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: false, isDirectory: false, uri: 'file:///tmp/photo.jpg' } as Awaited<ReturnType<typeof FileSystem.getInfoAsync>>)

    await expect(uploadDraftMedia('user-1', 'draft-a', [localAsset()])).rejects.toThrow('Draft media file was not found')
  })
})
