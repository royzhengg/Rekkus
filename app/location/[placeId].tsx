import { Redirect, useLocalSearchParams } from 'expo-router'

export default function LegacyRestaurantDetailRedirect() {
  const params = useLocalSearchParams<{
    placeId: string
    name?: string
    address?: string
    lat?: string
    lng?: string
  }>()

  return (
    <Redirect
      href={{
        pathname: '/restaurants/[restaurantId]',
        params: { ...params, restaurantId: params.placeId },
      }}
    />
  )
}
