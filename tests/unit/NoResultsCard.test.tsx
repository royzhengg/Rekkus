import { fireEvent, render } from '@testing-library/react-native'
import { NoResultsCard } from '@/features/search/NoResultsCard'

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

describe('NoResultsCard', () => {
  it('shows the search term in the heading', () => {
    const { getByText } = render(
      <NoResultsCard query="xyzzy" onChipPress={jest.fn()} />
    )
    expect(getByText(/No results for "xyzzy"/)).toBeTruthy()
  })

  it('renders at least 2 alternative chips', () => {
    const { getAllByRole } = render(
      <NoResultsCard query="xyzzy" onChipPress={jest.fn()} />
    )
    expect(getAllByRole('button').length).toBeGreaterThanOrEqual(2)
  })

  it('calls onChipPress with the chip query when a chip is tapped', () => {
    const onChipPress = jest.fn()
    const { getAllByRole } = render(
      <NoResultsCard query="xyzzy" onChipPress={onChipPress} />
    )
    fireEvent.press(getAllByRole('button')[0])
    expect(onChipPress).toHaveBeenCalledWith(expect.any(String))
  })
})
