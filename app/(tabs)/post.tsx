import { Redirect } from 'expo-router'
import { routes } from '@/lib/routes'

export default function LegacyCreateTabRedirect() {
  return <Redirect href={routes.createPost()} />
}
