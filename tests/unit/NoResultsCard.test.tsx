import { render } from '@testing-library/react-native'
import { NoResultsCard } from '@/features/search/NoResultsCard'
import type { NoResultsSuggestionChip } from '@/lib/hooks/useNoResultsSuggestions'

jest.mock('@/lib/contexts/ThemeContext', () => ({
  useThemeColors: () => ({
    bg: '#FFFFFF',
    text: '#000000',
    text2: '#444444',
    text3: '#888888',
    surface: '#F5F5F5',
    surface2: '#EEEEEE',
    border: '#DDDDDD',
    accent: '#FF5733',
    focused: '#FFE0D6',
  }),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/lib/routes', () => ({
  routes: { placeDetail: jest.fn((opts: { placeId: string }) => `/places/${opts.placeId}`) },
}))

const chips: NoResultsSuggestionChip[] = [
  { label: 'Sushi', emoji: '🍣', query: 'sushi' },
  { label: 'Pasta', query: 'pasta' },
  { label: 'Dumplings', emoji: '🥟', query: 'dumplings' },
]

describe('NoResultsCard', () => {
  it('shows the search term in the heading', () => {
    const { getByText } = render(
      <NoResultsCard query="xyzzy" chips={chips} onChipPress={jest.fn()} />
    )
    expect(getByText(/Nothing for "xyzzy" yet/)).toBeTruthy()
  })

  it('renders without crashing when no nearby places', () => {
    const { getByText } = render(
      <NoResultsCard query="Indian" chips={chips} onChipPress={jest.fn()} />
    )
    expect(getByText(/Nothing for "Indian" yet/)).toBeTruthy()
  })

  it('shows "Nearby instead" section when nearbyPlaces provided', () => {
    const nearby = [
      {
        id: 'p1',
        name: 'Kindred',
        address: '1 King St',
        city: 'Sydney',
        cuisine_type: 'Australian',
        google_place_id: null,
        latitude: -33.8,
        longitude: 151.2,
        google_rating: 4.5,
        google_review_count: 100,
      },
    ]
    const { getByText } = render(
      <NoResultsCard query="Indian" chips={chips} onChipPress={jest.fn()} nearbyPlaces={nearby} />
    )
    expect(getByText('Popular places')).toBeTruthy()
    expect(getByText('Kindred')).toBeTruthy()
  })
})
