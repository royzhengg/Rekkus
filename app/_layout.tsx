import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import 'react-native-reanimated'
import { PostsProvider } from '@/lib/PostsContext'
import { AuthProvider } from '@/lib/AuthContext'
import { AuthGateProvider } from '@/lib/AuthGateContext'
import { SettingsProvider } from '@/lib/SettingsContext'

export { ErrorBoundary } from 'expo-router'

export const unstable_settings = {
  initialRouteName: '(tabs)',
}

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'DMSerifDisplay-Regular': require('../assets/fonts/DMSerifDisplay-Regular.ttf'),
  })

  useEffect(() => {
    if (error) throw error
  }, [error])

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync()
  }, [loaded])

  if (!loaded) return null

  return (
    <AuthProvider>
      <PostsProvider>
        <SettingsProvider>
          <AuthGateProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="post/[id]" />
              <Stack.Screen name="location/[placeId]" />
              <Stack.Screen name="settings" />
            </Stack>
          </AuthGateProvider>
        </SettingsProvider>
      </PostsProvider>
    </AuthProvider>
  )
}
