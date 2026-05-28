import { act, renderHook } from '@testing-library/react-native'
import * as Location from 'expo-location'
import { useUserLocation } from '@/lib/hooks/useUserLocation'

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 'balanced' },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  geocodeAsync: jest.fn(),
}))

const mockRequestPermission = jest.mocked(Location.requestForegroundPermissionsAsync)
const mockGetPosition = jest.mocked(Location.getCurrentPositionAsync)

describe('useUserLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('does not request foreground location permission on mount', () => {
    renderHook(() => useUserLocation())

    expect(mockRequestPermission).not.toHaveBeenCalled()
    expect(mockGetPosition).not.toHaveBeenCalled()
  })

  it('requests foreground location after an explicit request', async () => {
    mockRequestPermission.mockResolvedValue({ status: 'granted' } as Location.LocationPermissionResponse)
    mockGetPosition.mockResolvedValue({
      coords: { latitude: -33.87, longitude: 151.21 },
    } as Location.LocationObject)
    const { result } = renderHook(() => useUserLocation())

    await act(async () => {
      await result.current.requestLocation()
    })

    expect(mockRequestPermission).toHaveBeenCalledTimes(1)
    expect(mockGetPosition).toHaveBeenCalledTimes(1)
    expect(result.current.coords).toEqual({ lat: -33.87, lng: 151.21 })
  })
})
