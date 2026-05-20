import { Redirect, useLocalSearchParams } from 'expo-router'

export default function LegacyPostDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <Redirect href={{ pathname: '/posts/[postId]', params: { postId: id } }} />
}
