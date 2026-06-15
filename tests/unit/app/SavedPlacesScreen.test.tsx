import { render, screen } from '@testing-library/react-native'
import SavedPlacesScreen from '@/app/saved/places'

const mockBack = jest.fn()
let mockParams: { view?: string } = {}

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: mockBack }),
}))

jest.mock('@/features/places/PlacesTabScreen', () => {
  const { Text } = jest.requireActual('react-native')
  return function MockPlacesTabScreen({ initialView }: { initialView?: 'list' | 'map' }) {
    return <Text>{`places-${initialView ?? 'list'}`}</Text>
  }
})

describe('SavedPlacesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockParams = {}
  })

  it('defaults saved places to list view', () => {
    render(<SavedPlacesScreen />)
    expect(screen.getByText('places-list')).toBeTruthy()
  })

  it('opens saved places directly in map view when requested', () => {
    mockParams = { view: 'map' }
    render(<SavedPlacesScreen />)
    expect(screen.getByText('places-map')).toBeTruthy()
  })
})
