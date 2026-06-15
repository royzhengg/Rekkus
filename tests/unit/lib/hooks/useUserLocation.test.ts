import { act, renderHook } from '@testing-library/react-native'
import * as Location from 'expo-location'
import React from 'react'
import { UserLocationProvider } from '@/lib/contexts/UserLocationContext'
import { useUserLocation } from '@/lib/hooks/useUserLocation'

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 'balanced' },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  geocodeAsync: jest.fn(),
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}))

const mockRequestPermission = jest.mocked(Location.requestForegroundPermissionsAsync)
const mockGetPosition = jest.mocked(Location.getCurrentPositionAsync)

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(UserLocationProvider, null, children)

describe('useUserLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('does not request foreground location permission on mount', () => {
    renderHook(() => useUserLocation(), { wrapper })

    expect(mockRequestPermission).not.toHaveBeenCalled()
    expect(mockGetPosition).not.toHaveBeenCalled()
  })

  it('requests foreground location after an explicit request', async () => {
    mockRequestPermission.mockResolvedValue({ status: 'granted' } as Location.LocationPermissionResponse)
    mockGetPosition.mockResolvedValue({
      coords: { latitude: -33.87, longitude: 151.21 },
    } as Location.LocationObject)
    const { result } = renderHook(() => useUserLocation(), { wrapper })

    await act(async () => {
      await result.current.requestLocation()
    })

    expect(mockRequestPermission).toHaveBeenCalledTimes(1)
    expect(mockGetPosition).toHaveBeenCalledTimes(1)
    expect(result.current.coords).toEqual({ lat: -33.87, lng: 151.21 })
  })

  it('transitions idle → requesting → granted with correct intermediate state', async () => {
    let resolvePermission!: (v: Location.LocationPermissionResponse) => void
    mockRequestPermission.mockReturnValue(
      new Promise(res => { resolvePermission = res })
    )
    mockGetPosition.mockResolvedValue({
      coords: { latitude: -33.87, longitude: 151.21 },
    } as Location.LocationObject)
    const { result } = renderHook(() => useUserLocation(), { wrapper })

    expect(result.current.status).toBe('idle')

    let requestPromise!: Promise<unknown>
    act(() => { requestPromise = result.current.requestLocation() })
    expect(result.current.status).toBe('requesting')

    await act(async () => {
      resolvePermission({ status: 'granted' } as Location.LocationPermissionResponse)
      await requestPromise
    })

    expect(result.current.status).toBe('granted')
    expect(result.current.coords).toEqual({ lat: -33.87, lng: 151.21 })
  })

  it('sets status to denied when permission is not granted', async () => {
    mockRequestPermission.mockResolvedValue({ status: 'denied' } as Location.LocationPermissionResponse)
    const { result } = renderHook(() => useUserLocation(), { wrapper })

    await act(async () => {
      await result.current.requestLocation()
    })

    expect(result.current.status).toBe('denied')
    expect(result.current.coords).toBeNull()
    expect(mockGetPosition).not.toHaveBeenCalled()
  })

  it('sets status to error when getCurrentPositionAsync throws', async () => {
    mockRequestPermission.mockResolvedValue({ status: 'granted' } as Location.LocationPermissionResponse)
    mockGetPosition.mockRejectedValue(new Error('location unavailable'))
    const { result } = renderHook(() => useUserLocation(), { wrapper })

    await act(async () => {
      await result.current.requestLocation()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.coords).toBeNull()
  })
})
