import { Redirect, useLocalSearchParams } from 'expo-router'
import { routeParamsObject, routeParamString } from '@/lib/utils/routeParams'

export default function LegacyRestaurantDetailRedirect() {
  const params = useLocalSearchParams<{
    placeId: string
    name?: string
    address?: string
    lat?: string
    lng?: string
  }>()
  const placeId = routeParamString(params.placeId) ?? 'none'
  const forwarded = routeParamsObject(params, ['placeId', 'name', 'address', 'lat', 'lng'])

  return (
    <Redirect
      href={{
        pathname: '/places/[placeId]',
        params: { ...forwarded, placeId },
      }}
    />
  )
}
