import { Redirect, useLocalSearchParams } from 'expo-router'

export default function LegacyRestaurantMapRedirect() {
  const params = useLocalSearchParams<{
    placeId?: string
    name?: string
    address?: string
    lat?: string
    lng?: string
    phone?: string
    photo?: string
  }>()
  const restaurantId = params.placeId ?? 'none'

  return (
    <Redirect
      href={{
        pathname: '/restaurants/[restaurantId]/map',
        params: { ...params, restaurantId },
      }}
    />
  )
}
