import { renderHook, waitFor } from '@testing-library/react-native'
import { useSavedDishes } from '@/lib/hooks/useSavedDishes'
import { useSavedPlaceIds } from '@/lib/hooks/useSavedPlaceIds'
import { fetchSavedDishes } from '@/lib/services/dishes'
import { fetchSavedPlaceIds } from '@/lib/services/places'

jest.mock('expo-router', () => {
  const { useEffect } = require('react') as { useEffect: (...args: unknown[]) => void }
  return {
    useFocusEffect: jest.fn((cb: () => (() => void) | void) => useEffect(cb, [cb])),
  }
})

jest.mock('@/lib/services/dishes', () => ({
  fetchSavedDishes: jest.fn(),
}))

jest.mock('@/lib/services/places', () => ({
  fetchSavedPlaceIds: jest.fn(),
}))

const mockFetchSavedDishes = jest.mocked(fetchSavedDishes)
const mockFetchSavedRestaurantIds = jest.mocked(fetchSavedPlaceIds)

describe('saved library dependency hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchSavedDishes.mockResolvedValue([])
    mockFetchSavedRestaurantIds.mockResolvedValue([])
  })

  it('does not refetch saved dishes when rerendered with the same user', async () => {
    const { rerender } = renderHook(({ userId }: { userId: string }) => useSavedDishes(userId), {
      initialProps: { userId: 'user-1' },
    })

    await waitFor(() => expect(mockFetchSavedDishes).toHaveBeenCalledTimes(1))
    rerender({ userId: 'user-1' })

    expect(mockFetchSavedDishes).toHaveBeenCalledTimes(1)
  })

  it('does not refetch saved restaurant ids when rerendered with the same user', async () => {
    const { rerender } = renderHook(({ userId }: { userId: string }) => useSavedPlaceIds(userId), {
      initialProps: { userId: 'user-1' },
    })

    await waitFor(() => expect(mockFetchSavedRestaurantIds).toHaveBeenCalledTimes(1))
    rerender({ userId: 'user-1' })

    expect(mockFetchSavedRestaurantIds).toHaveBeenCalledTimes(1)
  })
})
