import { Redirect } from 'expo-router'
import { routes } from '@/lib/routes'

export default function LegacyRestaurantsTabRedirect() {
  return <Redirect href={routes.saved('places')} />
}
