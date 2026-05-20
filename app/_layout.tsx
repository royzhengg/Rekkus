import { useFonts } from 'expo-font'
import { Stack, useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import 'react-native-reanimated'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as Linking from 'expo-linking'
import { PostsProvider } from '@/lib/contexts/PostsContext'
import { AuthProvider, useAuth } from '@/lib/contexts/AuthContext'
import { AuthGateProvider } from '@/lib/contexts/AuthGateContext'
import { SettingsProvider } from '@/lib/contexts/SettingsContext'
import { PostUploadProvider } from '@/lib/contexts/PostUploadContext'
import { CreateLauncherProvider } from '@/lib/contexts/CreateLauncherContext'
import { registerPushToken } from '@/lib/services/notifications'
import { supabase } from '@/lib/supabase'

export { ErrorBoundary } from 'expo-router'

export const unstable_settings = {
  initialRouteName: '(tabs)',
}

SplashScreen.preventAutoHideAsync()

function PushRegistrar() {
  const { user } = useAuth()
  useEffect(() => {
    if (user) registerPushToken(user.id)
  }, [user?.id])
  return null
}

function DeepLinkHandler() {
  const router = useRouter()

  useEffect(() => {
    async function handleUrl(url: string) {
      const fragment = url.includes('#') ? url.split('#')[1] : (url.split('?')[1] ?? '')
      const params = new URLSearchParams(fragment)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const type = params.get('type')
      if (accessToken && refreshToken && type === 'recovery') {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        router.replace('/(auth)/reset-password')
      }
    }

    Linking.getInitialURL().then(url => { if (url) handleUrl(url) })
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url))
    return () => sub.remove()
  }, [])

  return null
}

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    {loaded ? <AuthProvider>
      <PushRegistrar />
      <DeepLinkHandler />
      <PostsProvider>
        <PostUploadProvider>
          <SettingsProvider>
            <AuthGateProvider>
              <CreateLauncherProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="posts/[postId]" />
                  <Stack.Screen name="post/[id]" />
                  <Stack.Screen name="location/[placeId]" />
                  <Stack.Screen name="settings" />
                  <Stack.Screen name="messages" />
                  <Stack.Screen name="create/drafts" />
                </Stack>
              </CreateLauncherProvider>
            </AuthGateProvider>
          </SettingsProvider>
        </PostUploadProvider>
      </PostsProvider>
    </AuthProvider> : null}
    </GestureHandlerRootView>
  )
}
