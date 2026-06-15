import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import CreatePostScreen from '@/features/create-post/CreatePostScreen'
import type { PostMedia } from '@/types/domain'
import type { Dispatch, SetStateAction } from 'react'


const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
}
const mockNavigation = {
  dispatch: jest.fn(),
}

jest.mock('@react-navigation/native', () => ({
  usePreventRemove: jest.fn(),
}))

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useNavigation: () => mockNavigation,
  useLocalSearchParams: () => ({ intent: 'new' }),
  useFocusEffect: jest.fn(),
}))

jest.mock('@/components/icons', () => {
  const { Text } = jest.requireActual('react-native')
  const Stub = () => <Text>icon</Text>
  return { ChevronLeft: Stub, ArrowRight: Stub, SaveDraftIcon: Stub }
})

jest.mock('@/components/post-create/StepMedia', () => {
  const { Pressable, Text, View } = jest.requireActual('react-native')
  return function MockStepMedia({
    setMedia,
    setTitle,
  }: {
    setMedia: Dispatch<SetStateAction<PostMedia[]>>
    setTitle: Dispatch<SetStateAction<string>>
  }) {
    return (
      <View>
        <Text>Step Media Content</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add required post basics"
          onPress={() => {
            setTitle('Great ramen')
            setMedia([{ localId: 'media-1', uri: 'file:///ramen.jpg', type: 'image' }])
          }}
        >
          <Text>Add basics</Text>
        </Pressable>
      </View>
    )
  }
})

jest.mock('@/components/post-create/StepDetails', () => {
  const { Text } = jest.requireActual('react-native')
  return function MockStepDetails() {
    return <Text>Step Details Content</Text>
  }
})

jest.mock('@/components/post-create/StepReview', () => {
  const { Text } = jest.requireActual('react-native')
  return function MockStepReview() {
    return <Text>Step Review Content</Text>
  }
})

jest.mock('@/components/ui/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => {
    const { Text } = jest.requireActual('react-native')
    return <Text>{title}</Text>
  },
}))

jest.mock('@/components/ui/RekkusActionSheet', () => ({ RekkusActionSheet: () => null }))
jest.mock('@/features/create-post/CreatePostSheets', () => ({ CreatePostSheets: () => null }))

jest.mock('@/lib/contexts/ThemeContext', () => {
  const { lightColors } = jest.requireActual('@/constants/Colors')
  return { useThemeColors: () => lightColors }
})

jest.mock('@/lib/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

jest.mock('@/lib/contexts/AuthGateContext', () => ({
  useAuthGate: () => ({ requireAuth: jest.fn() }),
}))

jest.mock('@/lib/contexts/ConnectivityContext', () => ({
  useConnectivity: () => ({ requireOnline: () => true }),
}))

jest.mock('@/lib/contexts/PostsContext', () => ({
  usePosts: () => ({ refresh: jest.fn() }),
}))

jest.mock('@/lib/contexts/PostUploadContext', () => ({
  usePostUploadQueue: () => ({
    jobs: [],
    startJob: jest.fn(),
    updateJob: jest.fn(),
    completeJob: jest.fn(),
    failJob: jest.fn(),
    clearJob: jest.fn(),
  }),
}))

jest.mock('@/lib/featureFlags', () => ({
  useFeatureFlag: jest.fn(),
  isEnabled: jest.fn(),
}))

jest.mock('@/lib/analytics', () => ({
  analytics: {
    createPostFunnel: jest.fn(),
    deadClick: jest.fn(),
    postEdit: jest.fn(),
    rageTap: jest.fn(),
    restaurantFieldSkipped: jest.fn(),
  },
}))

jest.mock('@/lib/haptics', () => ({ haptic: { confirmPublish: jest.fn() } }))
jest.mock('@/lib/routes', () => ({ routes: { createDrafts: () => '/create/drafts', postDetail: (id: string) => `/posts/${id}` } }))
jest.mock('@/lib/dataSources/rekkusPicks', () => ({ tasteToLegacyFood: () => 0, valueToLegacyCost: () => 0 }))
jest.mock('@/lib/services/dishes', () => ({ findOrCreateDish: jest.fn() }))
jest.mock('@/lib/services/postMediaProcessing', () => ({ enqueueServerMediaProcessing: jest.fn() }))
jest.mock('@/lib/services/posts', () => ({
  createPost: jest.fn(),
  loadPostForEditing: jest.fn(),
  recordPostEditEvent: jest.fn(),
  updatePost: jest.fn(),
}))
jest.mock('@/lib/services/postDrafts', () => ({
  clearCreatePostDraft: jest.fn(),
  listCreatePostDraftSummaries: jest.fn(() => Promise.resolve([])),
  loadCreatePostDraft: jest.fn(() => Promise.resolve(null)),
  markCreatePostDraftPublished: jest.fn(),
  saveCreatePostDraftAsNew: jest.fn(),
  saveCreatePostDraftRemote: jest.fn(),
  saveCreatePostDraft: jest.fn(() => Promise.resolve({ id: 'draft-1', remoteId: 'draft-1', status: 'autosave' })),
}))

describe('CreatePostScreen progress indicator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renders progress dots and updates accessible step label on advance', async () => {
    render(<CreatePostScreen />)

    await waitFor(() => expect(screen.getByText('Step Media Content')).toBeTruthy())

    expect(screen.getByLabelText('Step 1 of 3')).toBeTruthy()
    expect(screen.queryByText('1 of 3')).toBeNull()
    expect(screen.queryByText('Title')).toBeNull()
    expect(screen.getAllByText('Media')).toHaveLength(1)

    fireEvent.press(screen.getByLabelText('Add required post basics'))
    fireEvent.press(screen.getByLabelText('Next'))

    await waitFor(() => expect(screen.getByText('Step Details Content')).toBeTruthy())
    expect(screen.getByLabelText('Step 2 of 3')).toBeTruthy()
  })
})
