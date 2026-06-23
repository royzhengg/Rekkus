import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as ImagePicker from 'expo-image-picker'
import StepMedia from '@/components/post-create/StepMedia'
import { analytics } from '@/lib/analytics'
import { usePlaceSearch } from '@/lib/hooks/usePlaceSearch'
import { preparePostMedia } from '@/lib/services/postMediaProcessing'
import type { PostMedia } from '@/types/domain'
import type React from 'react'

jest.mock('expo-sqlite/localStorage/install', () => {})
jest.mock('expo-sqlite', () => ({}))

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native')
  const useSharedValue = (initial: number) => ({ value: initial })
  const useAnimatedStyle = (fn: () => object) => fn()
  const withSpring = (value: number) => value
  const createAnimatedComponent = (c: unknown) => c
  return {
    __esModule: true,
    default: { View, createAnimatedComponent },
    FadeIn: { duration: () => undefined },
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    createAnimatedComponent,
  }
})


jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}))

jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native')
  const noop = () => {}
  const chainable = { onUpdate: () => chainable, onEnd: () => chainable, onStart: () => chainable, enabled: () => chainable, runOnJS: () => chainable, simultaneousWithExternalGesture: () => chainable, blocksExternalGesture: () => chainable }
  return {
    Gesture: { Pan: () => chainable, Tap: () => chainable, LongPress: () => chainable },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
    PanGestureHandler: ({ children }: { children: React.ReactNode }) => children,
    TouchableOpacity: View,
    gestureHandlerRootHOC: (c: unknown) => c,
    State: { BEGAN: 2, ACTIVE: 4, END: 5, FAILED: 1, CANCELLED: 3, UNDETERMINED: 0 },
    Directions: {},
    runOnJS: (fn: (...args: unknown[]) => void) => fn,
    __esModule: true,
    default: noop,
  }
})

jest.mock('@/lib/hooks/usePlaceSearch', () => ({
  usePlaceSearch: jest.fn(),
}))

jest.mock('@/lib/contexts/ThemeContext', () => {
  const { lightColors } = jest.requireActual('@/constants/Colors')
  return { useThemeColors: () => lightColors }
})

jest.mock('@/lib/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }))

jest.mock('@/lib/analytics', () => ({
  analytics: { dishTagOnboardingShown: jest.fn(), mediaEvent: jest.fn(), uploadFailure: jest.fn() },
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(() => Promise.resolve('1')), setItem: jest.fn() },
}))

jest.mock('expo-image-picker', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  UIImagePickerPresentationStyle: { FULL_SCREEN: 'fullScreen' },
  getMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  getCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
}))

jest.mock('@/lib/services/media', () => ({
  MEDIA_LIMITS: { maxPostMedia: 10, maxPostVideoSeconds: 60 },
  validatePickedPostMedia: jest.fn(),
}))

jest.mock('@/lib/services/postMediaProcessing', () => ({ preparePostMedia: jest.fn() }))

jest.mock('@/lib/featureFlags', () => ({ isEnabled: () => false }))

jest.mock('@/components/DishTagOverlay', () => ({ __esModule: true, default: () => null }))

jest.mock('@/components/post-create/DraggableMediaStrip', () => ({
  __esModule: true,
  default: () => null,
}))

const mockUsePlaceSearch = jest.mocked(usePlaceSearch)
const mockPreparePostMedia = jest.mocked(preparePostMedia)
const mockMediaEvent = jest.mocked(analytics.mediaEvent)
const mockUploadFailure = jest.mocked(analytics.uploadFailure)

function baseHookReturn(overrides: Partial<ReturnType<typeof usePlaceSearch>> = {}): ReturnType<typeof usePlaceSearch> {
  return {
    locationSearch: '',
    predictions: [],
    predictionsLoading: false,
    selectingPlace: false,
    nearbyPlaces: [],
    nearbyLoading: false,
    searchFocused: false,
    showNearby: false,
    showDropdown: false,
    locationStatus: 'granted',
    locationConstrained: true,
    placeTagIntent: { kind: 'general', providerIntent: 'general', confidence: 0.2 },
    requestLocationAndSearch: jest.fn(),
    handleSearchChange: jest.fn(),
    selectPrediction: jest.fn(),
    onSearchFocus: jest.fn(),
    onSearchBlur: jest.fn(),
    clearSearch: jest.fn(),
    ...overrides,
  }
}

const defaultProps = {
  media: [],
  setMedia: jest.fn(),
  title: '',
  setTitle: jest.fn(),
  selectedPlace: null,
  setSelectedPlace: jest.fn(),
  cuisineType: '',
  dishTags: [],
  setDishTags: jest.fn(),
}

describe('StepMedia location nudge', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUsePlaceSearch.mockReturnValue(baseHookReturn())
    mockPreparePostMedia.mockResolvedValue({ media: [], rejectedCount: 0, error: null })
  })

  it('does not show nudge when locationStatus is granted', () => {
    render(<StepMedia {...defaultProps} />)
    expect(screen.queryByText('Enable location for better results')).toBeNull()
  })

  it('does not show nudge when a place is already selected', () => {
    mockUsePlaceSearch.mockReturnValue(baseHookReturn({ locationStatus: 'idle' }))
    render(
      <StepMedia
        {...defaultProps}
        selectedPlace={{ googlePlaceId: 'gp-1', placeId: 'p1', name: 'Ramen Bar', address: '1 Food St', lat: -33.87, lng: 151.21 }}
      />
    )
    expect(screen.queryByText('Enable location for better results')).toBeNull()
  })

  it('shows location nudge for any zero-result search without location', () => {
    const requestLocationAndSearch = jest.fn()
    mockUsePlaceSearch.mockReturnValue(baseHookReturn({
      locationSearch: 'cafe',
      searchFocused: true,
      showDropdown: true,
      locationStatus: 'idle',
      locationConstrained: false,
      placeTagIntent: { kind: 'venue_category', providerIntent: 'food_dish', confidence: 0.87 },
      requestLocationAndSearch,
    }))

    render(<StepMedia {...defaultProps} />)

    expect(screen.getByText('No results for "cafe"')).toBeTruthy()
    fireEvent.press(screen.getByText('Use current location'))
    expect(requestLocationAndSearch).toHaveBeenCalledTimes(1)
  })

  it('shows disabled "Getting location…" button while location is being fetched', () => {
    mockUsePlaceSearch.mockReturnValue(baseHookReturn({
      locationSearch: 'pasta',
      searchFocused: true,
      showDropdown: true,
      locationStatus: 'requesting',
      locationConstrained: false,
      placeTagIntent: { kind: 'dish_or_menu_item', providerIntent: 'food_dish', confidence: 0.86 },
    }))

    render(<StepMedia {...defaultProps} />)

    expect(screen.getByText('Getting location…')).toBeTruthy()
  })

  it('shows location nudge for dish searches without location', () => {
    mockUsePlaceSearch.mockReturnValue(baseHookReturn({
      locationSearch: 'omelette',
      searchFocused: true,
      showDropdown: true,
      locationStatus: 'idle',
      locationConstrained: false,
      placeTagIntent: { kind: 'dish_or_menu_item', providerIntent: 'food_dish', confidence: 0.86 },
    }))

    render(<StepMedia {...defaultProps} />)

    expect(screen.getByText('No results for "omelette"')).toBeTruthy()
    expect(screen.getByText('Use current location')).toBeTruthy()
  })

  it('renders distance section headers for typed restaurant predictions', () => {
    mockUsePlaceSearch.mockReturnValue(baseHookReturn({
      locationSearch: 'ramen',
      searchFocused: true,
      showDropdown: true,
      predictions: [
        {
          place_id: 'near',
          description: 'Near Ramen',
          structured_formatting: { main_text: 'Near Ramen', secondary_text: '1km' },
          distanceGroup: 'nearby',
        },
        {
          place_id: 'city',
          description: 'City Ramen',
          structured_formatting: { main_text: 'City Ramen', secondary_text: '20km' },
          distanceGroup: 'city',
        },
      ],
    }))

    render(<StepMedia {...defaultProps} />)

    expect(screen.getByText('Nearby')).toBeTruthy()
    expect(screen.getByText('Further away')).toBeTruthy()
  })

  it('renders distance section headers for nearby restaurants', () => {
    mockUsePlaceSearch.mockReturnValue(baseHookReturn({
      searchFocused: true,
      showNearby: true,
      nearbyPlaces: [
        {
          place_id: 'near',
          description: 'Near Ramen',
          structured_formatting: { main_text: 'Near Ramen', secondary_text: '1km' },
          distanceGroup: 'nearby',
        },
      ],
    }))

    render(<StepMedia {...defaultProps} />)

    expect(screen.getByText('Nearby on Rekkus')).toBeTruthy()
    expect(screen.getByText('Nearby')).toBeTruthy()
  })
})

describe('StepMedia — empty state and media present', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUsePlaceSearch.mockReturnValue(baseHookReturn())
    mockPreparePostMedia.mockResolvedValue({ media: [], rejectedCount: 0, error: null })
  })

  it('shows clean empty state with camera icon and Camera/Library buttons when no media', () => {
    render(<StepMedia {...defaultProps} />)
    expect(screen.getByText('Add your photos or videos')).toBeTruthy()
    expect(screen.getByLabelText('Take a photo')).toBeTruthy()
    expect(screen.getByLabelText('Choose from library')).toBeTruthy()
    // Recent photos strip is gone
    expect(screen.queryByText('RECENTS')).toBeNull()
  })

  it('shows Tag dishes pill button when media is present', () => {
    render(
      <StepMedia
        {...defaultProps}
        media={[{ localId: 'media-1', uri: 'file:///selected.jpg', type: 'image', processingStatus: 'ready' } as PostMedia]}
      />
    )
    expect(screen.getByLabelText('Tag dishes in photo')).toBeTruthy()
  })

  it('shows tagged dish chips as de-duped pills below the strip', () => {
    render(
      <StepMedia
        {...defaultProps}
        media={[
          { localId: 'media-1', uri: 'file:///selected.jpg', type: 'image', processingStatus: 'ready' } as PostMedia,
        ]}
        dishTags={[
          { name: 'Ramen', photoIndex: 0, x: 0.3, y: 0.5 },
          { name: 'Ramen', photoIndex: 0, x: 0.4, y: 0.6 }, // duplicate — should appear once
          { name: 'Gyoza', photoIndex: 0, x: 0.7, y: 0.3 },
        ]}
      />
    )
    const ramenChips = screen.getAllByText('Ramen')
    expect(ramenChips).toHaveLength(1) // de-duped
    expect(screen.getByText('Gyoza')).toBeTruthy()
  })
})

// Pickers are now launched directly from inline buttons — no intermediate modal to dismiss.
describe('StepMedia picker buttons', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUsePlaceSearch.mockReturnValue(baseHookReturn())
    jest.mocked(ImagePicker.getMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: ImagePicker.PermissionStatus.GRANTED,
      expires: 'never',
    })
    jest.mocked(ImagePicker.getCameraPermissionsAsync).mockResolvedValue({
      granted: true,
      canAskAgain: true,
      status: ImagePicker.PermissionStatus.GRANTED,
      expires: 'never',
    })
  })

  it('launches the camera when Camera button is tapped', async () => {
    const mockLaunchCamera = jest.mocked(ImagePicker.launchCameraAsync)
    mockLaunchCamera.mockResolvedValue({ canceled: true, assets: null } as unknown as ImagePicker.ImagePickerResult)

    render(<StepMedia {...defaultProps} />)

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Take a photo'))
    })

    expect(mockLaunchCamera).toHaveBeenCalledTimes(1)
  })

  it('launches the media library when Library button is tapped', async () => {
    const mockLaunchLibrary = jest.mocked(ImagePicker.launchImageLibraryAsync)
    mockLaunchLibrary.mockResolvedValue({ canceled: true, assets: null } as unknown as ImagePicker.ImagePickerResult)

    render(<StepMedia {...defaultProps} />)

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Choose from library'))
    })

    expect(mockLaunchLibrary).toHaveBeenCalledTimes(1)
    const callArg = mockLaunchLibrary.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callArg).not.toHaveProperty('presentationStyle')
  })

  it('shows an inline error when the library picker rejects', async () => {
    const mockLaunchLibrary = jest.mocked(ImagePicker.launchImageLibraryAsync)
    mockLaunchLibrary.mockRejectedValue(new Error('present failed'))

    render(<StepMedia {...defaultProps} />)

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Choose from library'))
    })

    await waitFor(() => {
      expect(screen.getByText('Could not add media')).toBeTruthy()
    })
    expect(screen.getByText('Could not open your media library. Please try again.')).toBeTruthy()
    expect(mockUploadFailure).toHaveBeenCalledWith(null, 'post_media_picker', 'picker_unavailable')
    expect(mockMediaEvent).toHaveBeenCalledWith(null, 'media_prepare_failed', 'post_create', {
      reason: 'present failed',
    })
  })
})
