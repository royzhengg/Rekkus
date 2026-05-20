import { Redirect } from 'expo-router'

export default function LegacyCreateTabRedirect() {
  return <Redirect href="/(tabs)/create" />
}
