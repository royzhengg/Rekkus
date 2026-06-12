import { useFonts } from 'expo-font'
import * as Linking from 'expo-linking'
import { Stack, useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { Platform } from 'react-native'
import 'react-native-reanimated'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ConnectivityNotice } from '@/components/ui/ConnectivityNotice'
import { AuthProvider, useAuth } from '@/lib/contexts/AuthContext'
import { AuthGateProvider } from '@/lib/contexts/AuthGateContext'
import { ConnectivityProvider } from '@/lib/contexts/ConnectivityContext'
import { CreateLauncherProvider } from '@/lib/contexts/CreateLauncherContext'
import { PostsProvider } from '@/lib/contexts/PostsContext'
import { PostUploadProvider } from '@/lib/contexts/PostUploadContext'
import { SettingsProvider } from '@/lib/contexts/SettingsContext'
import { ToastProvider } from '@/lib/contexts/ToastContext'
import { refreshFeatureFlagOverrides } from '@/lib/featureFlags'
import { restoreSession } from '@/lib/services/auth'
import { initializeCrashReporting, withCrashReporting } from '@/lib/services/crashReporting'
import { registerPushToken } from '@/lib/services/notifications'
import { loadSearchSynonymCache } from '@/lib/services/search'

export { ErrorBoundary } from 'expo-router'

export const unstable_settings = {
  initialRouteName: '(tabs)',
}

void SplashScreen.preventAutoHideAsync()
initializeCrashReporting()

function PushRegistrar() {
  const { user } = useAuth()
  useEffect(() => {
    if (user) void registerPushToken(user.id)
  }, [user])
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
        await restoreSession(accessToken, refreshToken)
        router.replace('/(auth)/reset-password')
      }
    }

    void Linking.getInitialURL().then(url => { if (url) void handleUrl(url) })
    const sub = Linking.addEventListener('url', ({ url }) => { void handleUrl(url) })
    return () => sub.remove()
  }, [router])

  return null
}

function FeatureFlagOverrideRefresher() {
  useEffect(() => {
    void refreshFeatureFlagOverrides(true)
    const interval = setInterval(() => {
      void refreshFeatureFlagOverrides()
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  return null
}

function SearchSynonymCacheLoader() {
  useEffect(() => {
    void loadSearchSynonymCache()
  }, [])

  return null
}

function RootLayout() {
  const [loaded, error] = useFonts({
    'DMSerifDisplay-Regular': require('../assets/fonts/DMSerifDisplay-Regular.ttf') as number,
  })

  useEffect(() => {
    if (error) throw error
  }, [error])

  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync()
  }, [loaded])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    {loaded ? <AuthProvider>
      <ConnectivityProvider>
      <FeatureFlagOverrideRefresher />
      <SearchSynonymCacheLoader />
      <PushRegistrar />
      <DeepLinkHandler />
      <PostsProvider>
        <PostUploadProvider>
          <SettingsProvider>
            <ToastProvider>
            <ConnectivityNotice />
            <AuthGateProvider>
              <CreateLauncherProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen
                    name="create"
                    options={{
                      presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen name="posts/[postId]" />
                  <Stack.Screen name="dishes/[dishId]" />
                  <Stack.Screen name="collections/[collectionId]" />
                  <Stack.Screen name="post/[id]" />
                  <Stack.Screen name="location/[placeId]" />
                  <Stack.Screen name="settings" />
                  <Stack.Screen name="messages" />
                </Stack>
              </CreateLauncherProvider>
            </AuthGateProvider>
            </ToastProvider>
          </SettingsProvider>
        </PostUploadProvider>
      </PostsProvider>
      </ConnectivityProvider>
    </AuthProvider> : null}
    </GestureHandlerRootView>
  )
}

export default withCrashReporting(RootLayout)
