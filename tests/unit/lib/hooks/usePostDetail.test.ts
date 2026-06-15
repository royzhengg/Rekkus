import { act, renderHook, waitFor } from '@testing-library/react-native'
import { usePostDetail } from '@/lib/hooks/usePostDetail'
import { addPostComment } from '@/lib/services/comments'
import { fetchPostSocialState } from '@/lib/services/posts'
import { fetchIsFollowing, fetchUserIdByUsername } from '@/lib/services/users'

// ── module mocks ──────────────────────────────────────────────────────────────

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() },
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush, replace: jest.fn() }),
}))

jest.mock('@/lib/analytics', () => ({
  analytics: {
    viewPost: jest.fn(),
    dwellPost: jest.fn(),
    follow: jest.fn(),
    actionError: jest.fn(),
    savePlace: jest.fn(),
  },
}))

jest.mock('@/lib/haptics', () => ({
  haptic: { confirmLike: jest.fn(() => Promise.resolve()), confirmSave: jest.fn(() => Promise.resolve()) },
}))

jest.mock('@/lib/contexts/ConnectivityContext', () => ({
  useConnectivity: () => ({
    requireOnline: mockRequireOnline,
    runDeferredMutation: mockRunDeferredMutation,
  }),
}))

jest.mock('@/lib/contexts/ToastContext', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}))

jest.mock('@/lib/services/posts', () => ({
  fetchPostSocialState: jest.fn(),
  addPostReaction: jest.fn(),
  removePostReaction: jest.fn(),
}))

jest.mock('@/lib/services/comments', () => ({
  addPostComment: jest.fn(),
}))

jest.mock('@/lib/services/users', () => ({
  fetchUserIdByUsername: jest.fn(),
  fetchIsFollowing: jest.fn(),
}))

jest.mock('@/lib/services/collections', () => ({
  fetchTargetCollectionItems: jest.fn(() => Promise.resolve([])),
}))

jest.mock('@/lib/services/places', () => ({
  upsertResolvedPlace: jest.fn(),
}))

jest.mock('@/features/posts/postDetailUtils', () => ({
  geocodeLocation: jest.fn(),
}))

// ── mock refs ─────────────────────────────────────────────────────────────────

const mockPush = jest.fn()
const mockRequireOnline = jest.fn(() => true)
const mockRunDeferredMutation = jest.fn(() => Promise.resolve())

const mockFetchSocialState = jest.mocked(fetchPostSocialState)
const mockAddPostComment = jest.mocked(addPostComment)
const mockFetchUserIdByUsername = jest.mocked(fetchUserIdByUsername)
const mockFetchIsFollowing = jest.mocked(fetchIsFollowing)

const socialState = {
  likeCount: 5,
  comments: [],
  reactionCounts: {},
  myReactions: [],
  liked: false,
  saved: false,
  locationSaved: false,
}

const resolvedPost = {
  id: 1,
  dbId: 'post-1',
  userId: 'creator-1',
  title: 'Great ramen',
  body: 'Loved it',
  creator: 'alice',
  initials: 'A',
  avatarBg: '#fff',
  avatarColor: '#000',
  likes: '5',
  imgKey: 'img-1',
  tall: false,
  tags: [],
  location: 'Golden Dumpling',
  food: 4,
  vibe: 4,
  cost: 2,
  placeId: 'rest-1',
}

function defaults() {
  mockFetchSocialState.mockResolvedValue(socialState as never)
  mockFetchUserIdByUsername.mockResolvedValue('creator-1')
  mockFetchIsFollowing.mockResolvedValue(false)
  mockAddPostComment.mockResolvedValue(undefined as never)
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('usePostDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    defaults()
  })

  it('starts with liked=false and likeCount=0 before load', () => {
    const { result } = renderHook(() =>
      usePostDetail(resolvedPost as never, 'user-1', {})
    )
    expect(result.current.liked).toBe(false)
    expect(result.current.likeCount).toBe(0)
  })

  it('loadSocialState populates liked, likeCount, and comments', async () => {
    const { result } = renderHook(() =>
      usePostDetail(resolvedPost as never, 'user-1', {})
    )
    await act(async () => { await result.current.loadSocialState() })

    expect(result.current.likeCount).toBe(5)
    expect(result.current.liked).toBe(false)
    expect(result.current.comments).toEqual([])
  })

  it('toggleLike optimistically flips liked and increments likeCount', async () => {
    mockFetchSocialState.mockResolvedValue({ ...socialState, liked: false, likeCount: 3 } as never)
    const { result } = renderHook(() =>
      usePostDetail(resolvedPost as never, 'user-1', {})
    )
    await act(async () => { await result.current.loadSocialState() })
    await act(async () => { await result.current.toggleLike() })

    expect(result.current.liked).toBe(true)
    expect(result.current.likeCount).toBe(4)
    expect(mockRunDeferredMutation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'post_like', postId: 'post-1', targetState: true })
    )
  })

  it('toggleLike reverts state when mutation fails', async () => {
    mockFetchSocialState.mockResolvedValue({ ...socialState, liked: false, likeCount: 3 } as never)
    mockRunDeferredMutation.mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() =>
      usePostDetail(resolvedPost as never, 'user-1', {})
    )
    await act(async () => { await result.current.loadSocialState() })
    await act(async () => { await result.current.toggleLike() })

    expect(result.current.liked).toBe(false)
    expect(result.current.likeCount).toBe(3)
    expect(result.current.operationError).toBeTruthy()
  })

  it('submitComment calls addPostComment and reloads social state', async () => {
    const { result } = renderHook(() =>
      usePostDetail(resolvedPost as never, 'user-1', {})
    )
    await act(async () => { result.current.setComment('Great dish!') })
    await act(async () => { await result.current.submitComment() })

    expect(mockAddPostComment).toHaveBeenCalledWith('post-1', 'user-1', 'Great dish!', null)
    expect(mockFetchSocialState).toHaveBeenCalledTimes(2) // initial load + after comment
  })

  it('submitComment sets offline error and skips service call when offline', async () => {
    mockRequireOnline.mockReturnValue(false)
    const { result } = renderHook(() =>
      usePostDetail(resolvedPost as never, 'user-1', {})
    )
    await act(async () => { result.current.setComment('hello') })
    await act(async () => { await result.current.submitComment() })

    expect(mockAddPostComment).not.toHaveBeenCalled()
    expect(result.current.operationError?.title).toBe('You are offline')
  })

  it('submitComment skips service call when comment text is empty', async () => {
    const { result } = renderHook(() =>
      usePostDetail(resolvedPost as never, 'user-1', {})
    )
    await act(async () => { await result.current.submitComment() })
    expect(mockAddPostComment).not.toHaveBeenCalled()
  })

  it('toggleFollowCreator calls follow mutation and flips following state', async () => {
    mockFetchIsFollowing.mockResolvedValue(false)
    const { result } = renderHook(() =>
      usePostDetail(resolvedPost as never, 'user-1', {})
    )
    await waitFor(() => {
      expect(result.current.creatorUserId).toBe('creator-1')
    })
    await act(async () => { await result.current.toggleFollowCreator() })

    expect(mockRunDeferredMutation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'follow', targetUserId: 'creator-1', targetState: true })
    )
    expect(result.current.following).toBe(true)
  })

  it('does nothing when resolvedPost is null', async () => {
    const { result } = renderHook(() =>
      usePostDetail(null, 'user-1', {})
    )
    await act(async () => { await result.current.loadSocialState() })
    expect(mockFetchSocialState).not.toHaveBeenCalled()
  })
})
