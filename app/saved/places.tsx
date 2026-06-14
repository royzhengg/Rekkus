import { useLocalSearchParams, useRouter } from 'expo-router'
import RestaurantsTabScreen from '@/features/restaurants/RestaurantsTabScreen'

export default function SavedPlacesScreen() {
  const { view } = useLocalSearchParams<{ view?: string }>()
  const router = useRouter()
  return <RestaurantsTabScreen initialView={view === 'map' ? 'map' : 'list'} onBackToSaved={() => router.back()} />
}
