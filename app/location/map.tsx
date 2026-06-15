import { Redirect, useLocalSearchParams } from 'expo-router'
import { routeParamsObject, routeParamString } from '@/lib/utils/routeParams'

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
  const placeId = routeParamString(params.placeId) ?? 'none'
  const forwarded = routeParamsObject(params, ['placeId', 'name', 'address', 'lat', 'lng', 'phone', 'photo'])

  return (
    <Redirect
      href={{
        pathname: '/places/[placeId]/map',
        params: { ...forwarded, placeId },
      }}
    />
  )
}
