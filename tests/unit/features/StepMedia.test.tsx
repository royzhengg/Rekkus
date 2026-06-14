import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import * as ImagePicker from 'expo-image-picker'
import * as MediaLibrary from 'expo-media-library'
import StepMedia from '@/components/post-create/StepMedia'
import { analytics } from '@/lib/analytics'
import { usePermissionRecovery } from '@/lib/hooks/usePermissionRecovery'
import { useRecentPhotos } from '@/lib/hooks/useRecentPhotos'
import { useRestaurantSearch } from '@/lib/hooks/useRestaurantSearch'
import { preparePostMedia } from '@/lib/services/postMediaProcessing'
import type { PostMedia } from '@/types/domain'

jest.mock('expo-sqlite/localStorage/install', () => {})
jest.mock('expo-sqlite', () => ({}))

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native')
  return { __esModule: true, default: { View }, FadeIn: { duration: () => undefined } }
})

jest.mock('@/lib/hooks/useRestaurantSearch', () => ({
  useRestaurantSearch: jest.fn(),
}))

jest.mock('@/lib/contexts/ThemeContext', () => {
  const { lightColors } = jest.requireActual('@/constants/Colors')
  return { useThemeColors: () => lightColors }
})

jest.mock('@/lib/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }))

jest.mock('@/lib/hooks/usePermissionRecovery', () => ({
  usePermissionRecovery: jest.fn(() => ({
    request: jest.fn(),
    recoveryVisible: false,
    recoveryMessage: '',
    dismissRecovery: jest.fn(),
    openSettings: jest.fn(),
  })),
}))

jest.mock('@/lib/hooks/useRecentPhotos', () => ({
  useRecentPhotos: jest.fn(),
}))

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

jest.mock('expo-media-library', () => ({
  getAssetInfoAsync: jest.fn(),
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

let capturedMediaOnSelect: ((v: string) => void) | undefined = undefined
jest.mock('@/components/ui/RekkusActionSheet', () => ({
  RekkusActionSheet: ({ title, visible, onSelect }: { title?: string; visible: boolean; onSelect: (v: string) => void }) => {
    if (visible && title === 'Add media') capturedMediaOnSelect = onSelect
    return null
  },
}))

const mockUseRestaurantSearch = jest.mocked(useRestaurantSearch)
const mockUseRecentPhotos = jest.mocked(useRecentPhotos)
const mockPreparePostMedia = jest.mocked(preparePostMedia)
const mockMediaEvent = jest.mocked(analytics.mediaEvent)
const mockUploadFailure = jest.mocked(analytics.uploadFailure)
const mockGetAssetInfo = jest.mocked(MediaLibrary.getAssetInfoAsync)

function baseHookReturn(overrides: Partial<ReturnType<typeof useRestaurantSearch>> = {}): ReturnType<typeof useRestaurantSearch> {
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
    restaurantTagIntent: { kind: 'general', providerIntent: 'general', confidence: 0.2 },
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
  mustOrder: '',
  setMustOrder: jest.fn(),
}

function recentPhoto(index: number) {
  return {
    id: `recent-${index}`,
    uri: `file:///recent-${index}.jpg`,
    width: 800,
    height: 600,
    filename: `recent-${index}.jpg`,
  }
}

function recentPhotoInfo(overrides: Partial<MediaLibrary.AssetInfo> = {}): MediaLibrary.AssetInfo {
  return {
    id: 'recent-0',
    filename: 'recent-0.jpg',
    uri: 'ph://recent-0',
    localUri: 'file:///recent-0.jpg',
    mediaType: 'photo',
    width: 800,
    height: 600,
    creationTime: 1000,
    modificationTime: 1000,
    duration: 0,
    ...overrides,
  }
}

describe('StepMedia location nudge', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    capturedMediaOnSelect = undefined
    mockUseRestaurantSearch.mockReturnValue(baseHookReturn())
    mockUseRecentPhotos.mockReturnValue({ photos: [], loading: false, denied: false, error: null })
    mockPreparePostMedia.mockResolvedValue({ media: [], rejectedCount: 0, error: null })
    mockGetAssetInfo.mockResolvedValue(recentPhotoInfo())
  })

  it('does not show nudge when locationStatus is granted', () => {
    render(<StepMedia {...defaultProps} />)
    expect(screen.queryByText('Enable location for better results')).toBeNull()
  })

  it('does not show nudge when a place is already selected', () => {
    mockUseRestaurantSearch.mockReturnValue(baseHookReturn({ locationStatus: 'idle' }))
    render(
      <StepMedia
        {...defaultProps}
        selectedPlace={{ placeId: 'p1', name: 'Ramen Bar', address: '1 Food St', lat: -33.87, lng: 151.21, restaurantId: 'r1' }}
      />
    )
    expect(screen.queryByText('Enable location for better results')).toBeNull()
  })

  it('shows location nudge for any zero-result search without location', () => {
    const requestLocationAndSearch = jest.fn()
    mockUseRestaurantSearch.mockReturnValue(baseHookReturn({
      locationSearch: 'cafe',
      searchFocused: true,
      showDropdown: true,
      locationStatus: 'idle',
      locationConstrained: false,
      restaurantTagIntent: { kind: 'venue_category', providerIntent: 'food_dish', confidence: 0.87 },
      requestLocationAndSearch,
    }))

    render(<StepMedia {...defaultProps} />)

    expect(screen.getByText('No results for "cafe"')).toBeTruthy()
    fireEvent.press(screen.getByText('Use current location'))
    expect(requestLocationAndSearch).toHaveBeenCalledTimes(1)
  })

  it('shows disabled "Getting location…" button while location is being fetched', () => {
    mockUseRestaurantSearch.mockReturnValue(baseHookReturn({
      locationSearch: 'pasta',
      searchFocused: true,
      showDropdown: true,
      locationStatus: 'requesting',
      locationConstrained: false,
      restaurantTagIntent: { kind: 'dish_or_menu_item', providerIntent: 'food_dish', confidence: 0.86 },
    }))

    render(<StepMedia {...defaultProps} />)

    expect(screen.getByText('Getting location…')).toBeTruthy()
  })

  it('shows location nudge for dish searches without location', () => {
    mockUseRestaurantSearch.mockReturnValue(baseHookReturn({
      locationSearch: 'omelette',
      searchFocused: true,
      showDropdown: true,
      locationStatus: 'idle',
      locationConstrained: false,
      restaurantTagIntent: { kind: 'dish_or_menu_item', providerIntent: 'food_dish', confidence: 0.86 },
    }))

    render(<StepMedia {...defaultProps} />)

    expect(screen.getByText('No results for "omelette"')).toBeTruthy()
    expect(screen.getByText('Use current location')).toBeTruthy()
  })

  it('renders distance section headers for typed restaurant predictions', () => {
    mockUseRestaurantSearch.mockReturnValue(baseHookReturn({
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
    mockUseRestaurantSearch.mockReturnValue(baseHookReturn({
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

  it('renders up to 5 recent photos while media is empty', () => {
    mockUseRecentPhotos.mockReturnValue({
      photos: Array.from({ length: 5 }, (_, index) => recentPhoto(index)),
      loading: false,
      denied: false,
      error: null,
    })

    render(<StepMedia {...defaultProps} />)

    expect(screen.getByText('RECENTS')).toBeTruthy()
    expect(screen.getByLabelText('Add recent photo 1')).toBeTruthy()
    expect(screen.getByLabelText('Add recent photo 5')).toBeTruthy()
  })

  it('hides recent photos when media already exists', () => {
    mockUseRecentPhotos.mockReturnValue({
      photos: [recentPhoto(0)],
      loading: false,
      denied: false,
      error: null,
    })

    render(
      <StepMedia
        {...defaultProps}
        media={[{ localId: 'media-1', uri: 'file:///selected.jpg', type: 'image' } as PostMedia]}
      />
    )

    expect(screen.queryByText('RECENTS')).toBeNull()
    expect(screen.queryByLabelText('Add recent photo 1')).toBeNull()
  })

  it('does not show the must-order prompt on the media step after media is added', () => {
    render(
      <StepMedia
        {...defaultProps}
        media={[{ localId: 'media-1', uri: 'file:///selected.jpg', type: 'image' } as PostMedia]}
      />
    )

    expect(screen.queryByPlaceholderText("What's the must-order dish?")).toBeNull()
    expect(screen.queryByLabelText('Must order dish')).toBeNull()
  })

  it('adds a tapped recent photo through media preparation', async () => {
    const nextMedia = [{ localId: 'media-1', uri: 'file:///recent-0.jpg', type: 'image' } as PostMedia]
    const setMedia = jest.fn()
    mockUseRecentPhotos.mockReturnValue({
      photos: [recentPhoto(0)],
      loading: false,
      denied: false,
      error: null,
    })
    mockPreparePostMedia.mockResolvedValue({ media: nextMedia, rejectedCount: 0, error: null })

    render(<StepMedia {...defaultProps} setMedia={setMedia} />)
    fireEvent.press(screen.getByLabelText('Add recent photo 1'))

    await waitFor(() => {
      expect(mockGetAssetInfo).toHaveBeenCalledWith('recent-0')
      expect(mockPreparePostMedia).toHaveBeenCalledWith(
        [{ uri: 'file:///recent-0.jpg', type: 'image', width: 800, height: 600, mimeType: 'image/jpeg' }],
        []
      )
    })
    expect(setMedia).toHaveBeenCalledWith(nextMedia)
    expect(mockMediaEvent).toHaveBeenCalledWith(null, 'recent_photo_selected', 'post_create')
  })

  it('resolves extensionless iOS recent photo URIs before media preparation', async () => {
    const nextMedia = [{ localId: 'media-1', uri: 'file:///resolved-recent.jpg', type: 'image' } as PostMedia]
    const setMedia = jest.fn()
    mockUseRecentPhotos.mockReturnValue({
      photos: [{ id: 'recent-ios', uri: 'ph://asset-id', width: 640, height: 480 }],
      loading: false,
      denied: false,
      error: null,
    })
    mockGetAssetInfo.mockResolvedValue(recentPhotoInfo({
      id: 'recent-ios',
      filename: 'IMG_0001',
      uri: 'ph://asset-id',
      localUri: 'file:///resolved-recent.jpg',
      width: 640,
      height: 480,
    }))
    mockPreparePostMedia.mockResolvedValue({ media: nextMedia, rejectedCount: 0, error: null })

    render(<StepMedia {...defaultProps} setMedia={setMedia} />)
    fireEvent.press(screen.getByLabelText('Add recent photo 1'))

    await waitFor(() => {
      expect(mockGetAssetInfo).toHaveBeenCalledWith('recent-ios')
      expect(mockPreparePostMedia).toHaveBeenCalledWith(
        [{ uri: 'file:///resolved-recent.jpg', type: 'image', width: 640, height: 480, mimeType: 'image/jpeg' }],
        []
      )
    })
    expect(setMedia).toHaveBeenCalledWith(nextMedia)
  })

  it('shows a clearer error when recent photo metadata cannot be read', async () => {
    mockUseRecentPhotos.mockReturnValue({
      photos: [{ id: 'recent-ios', uri: 'ph://asset-id', width: 640, height: 480 }],
      loading: false,
      denied: false,
      error: null,
    })
    mockGetAssetInfo.mockResolvedValue({
      id: 'recent-ios',
      filename: 'IMG_0001',
      uri: 'ph://asset-id',
      mediaType: 'photo',
      width: 640,
      height: 480,
      creationTime: 1000,
      modificationTime: 1000,
      duration: 0,
    })

    render(<StepMedia {...defaultProps} />)
    fireEvent.press(screen.getByLabelText('Add recent photo 1'))

    await waitFor(() => {
      expect(screen.getByText('Could not add media')).toBeTruthy()
    })
    expect(screen.getByText('Could not read this photo. Try Add media instead.')).toBeTruthy()
    expect(mockPreparePostMedia).not.toHaveBeenCalled()
    expect(mockUploadFailure).toHaveBeenCalledWith(null, 'post_recent_photo_strip', 'metadata_unavailable')
  })

  it('shows media error and upload analytics when recent photo is rejected', async () => {
    mockUseRecentPhotos.mockReturnValue({
      photos: [recentPhoto(0)],
      loading: false,
      denied: false,
      error: null,
    })
    mockPreparePostMedia.mockResolvedValue({
      media: [],
      rejectedCount: 1,
      error: 'Unsupported file type.',
    })

    render(<StepMedia {...defaultProps} />)
    fireEvent.press(screen.getByLabelText('Add recent photo 1'))

    await waitFor(() => {
      expect(screen.getByText('Could not add media')).toBeTruthy()
    })
    expect(screen.getByText('Unsupported file type.')).toBeTruthy()
    expect(mockUploadFailure).toHaveBeenCalledWith(
      null,
      'post_recent_photo_strip',
      'validation_rejected',
      1
    )
  })
})

// Regression: picker must not be called while the action sheet is still animating out.
// iOS silently drops a native picker presentation while a modal VC is still dismissing;
// Android can also fail on some versions for the same reason.
describe('StepMedia picker deferral', () => {
  const mockUsePermissionRecovery = jest.mocked(usePermissionRecovery)

  beforeEach(() => {
    jest.useFakeTimers()
    capturedMediaOnSelect = undefined
    jest.clearAllMocks()
    mockUseRestaurantSearch.mockReturnValue(baseHookReturn())
    mockUseRecentPhotos.mockReturnValue({ photos: [], loading: false, denied: false, error: null })
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
    mockUsePermissionRecovery.mockReturnValue({
      request: jest.fn().mockResolvedValue({ granted: true }),
      recoveryVisible: false,
      recoveryMessage: '',
      dismissRecovery: jest.fn(),
      openSettings: jest.fn(),
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('does not call launchCameraAsync synchronously when camera is selected from the sheet', async () => {
    const mockLaunchCamera = jest.mocked(ImagePicker.launchCameraAsync)
    mockLaunchCamera.mockResolvedValue({ canceled: true, assets: null })

    render(<StepMedia {...defaultProps} />)
    fireEvent.press(screen.getByLabelText('Add photos or video'))
    expect(capturedMediaOnSelect).toBeDefined()

    act(() => { capturedMediaOnSelect!('camera') })
    expect(mockLaunchCamera).not.toHaveBeenCalled()

    await act(async () => {
      jest.advanceTimersByTime(350)
      await null // flush the permission-check microtask so launchCameraAsync is reached
    })
    expect(mockLaunchCamera).toHaveBeenCalledTimes(1)
  })

  it('does not call launchImageLibraryAsync synchronously when library is selected from the sheet', async () => {
    const mockLaunchLibrary = jest.mocked(ImagePicker.launchImageLibraryAsync)
    mockLaunchLibrary.mockResolvedValue({ canceled: true, assets: null })

    render(<StepMedia {...defaultProps} />)
    fireEvent.press(screen.getByLabelText('Add photos or video'))
    expect(capturedMediaOnSelect).toBeDefined()

    act(() => { capturedMediaOnSelect!('library') })
    expect(mockLaunchLibrary).not.toHaveBeenCalled()

    await act(async () => {
      jest.advanceTimersByTime(350)
      await null
    })
    expect(mockLaunchLibrary).toHaveBeenCalledTimes(1)
    expect(mockLaunchLibrary).toHaveBeenCalledWith(expect.objectContaining({
      presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
    }))
  })

  it('waits for the permission prompt to settle before launching the library picker', async () => {
    const mockLaunchLibrary = jest.mocked(ImagePicker.launchImageLibraryAsync)
    const requestPermission = jest.fn().mockResolvedValue({ granted: true, canAskAgain: true })
    jest.mocked(ImagePicker.getMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: true,
      status: ImagePicker.PermissionStatus.UNDETERMINED,
      expires: 'never',
    })
    mockLaunchLibrary.mockResolvedValue({ canceled: true, assets: null })
    mockUsePermissionRecovery.mockReturnValue({
      request: requestPermission,
      recoveryVisible: false,
      recoveryMessage: '',
      dismissRecovery: jest.fn(),
      openSettings: jest.fn(),
    })

    render(<StepMedia {...defaultProps} />)
    fireEvent.press(screen.getByLabelText('Add photos or video'))
    expect(capturedMediaOnSelect).toBeDefined()

    act(() => { capturedMediaOnSelect!('library') })

    await act(async () => {
      jest.advanceTimersByTime(350)
      await null
    })
    expect(requestPermission).toHaveBeenCalledTimes(1)
    expect(mockLaunchLibrary).not.toHaveBeenCalled()

    await act(async () => {
      jest.advanceTimersByTime(349)
      await null
    })
    expect(mockLaunchLibrary).not.toHaveBeenCalled()

    await act(async () => {
      jest.advanceTimersByTime(1)
      await null
    })
    expect(mockLaunchLibrary).toHaveBeenCalledTimes(1)
  })

  it('delegates permanently denied library permission to recovery and does not launch', async () => {
    const mockLaunchLibrary = jest.mocked(ImagePicker.launchImageLibraryAsync)
    const requestPermission = jest.fn().mockResolvedValue({ granted: false, canAskAgain: false })
    jest.mocked(ImagePicker.getMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: false,
      status: ImagePicker.PermissionStatus.DENIED,
      expires: 'never',
    })
    mockUsePermissionRecovery.mockReturnValue({
      request: requestPermission,
      recoveryVisible: true,
      recoveryMessage: 'Photo library access is needed to add photos. Enable it in Settings.',
      dismissRecovery: jest.fn(),
      openSettings: jest.fn(),
    })

    render(<StepMedia {...defaultProps} />)
    fireEvent.press(screen.getByLabelText('Add photos or video'))
    expect(capturedMediaOnSelect).toBeDefined()

    act(() => { capturedMediaOnSelect!('library') })

    await act(async () => {
      jest.advanceTimersByTime(350)
      await null
    })
    expect(requestPermission).toHaveBeenCalledTimes(1)
    expect(mockLaunchLibrary).not.toHaveBeenCalled()
  })

  it('shows an inline error when the library picker rejects', async () => {
    const mockLaunchLibrary = jest.mocked(ImagePicker.launchImageLibraryAsync)
    mockLaunchLibrary.mockRejectedValue(new Error('present failed'))

    render(<StepMedia {...defaultProps} />)
    fireEvent.press(screen.getByLabelText('Add photos or video'))
    expect(capturedMediaOnSelect).toBeDefined()

    act(() => { capturedMediaOnSelect!('library') })

    await act(async () => {
      jest.advanceTimersByTime(350)
      await null
    })

    await waitFor(() => {
      expect(screen.getByText('Could not add media')).toBeTruthy()
    })
    expect(screen.getByText('Could not open your photo library. Please try again.')).toBeTruthy()
    expect(mockUploadFailure).toHaveBeenCalledWith(null, 'post_media_picker', 'picker_unavailable')
    expect(mockMediaEvent).toHaveBeenCalledWith(null, 'media_prepare_failed', 'post_create', {
      reason: 'present failed',
    })
  })
})
