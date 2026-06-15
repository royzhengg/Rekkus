import { useLocalSearchParams, useRouter } from 'expo-router'
import PlacesTabScreen from '@/features/places/PlacesTabScreen'

export default function SavedPlacesScreen() {
  const { view } = useLocalSearchParams<{ view?: string }>()
  const router = useRouter()
  return <PlacesTabScreen initialView={view === 'map' ? 'map' : 'list'} onBackToSaved={() => router.back()} />
}
