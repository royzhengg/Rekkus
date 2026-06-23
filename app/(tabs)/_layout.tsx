import { Tabs, useRouter } from 'expo-router'
import React from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { Svg, Circle, Path, Polyline, Line } from 'react-native-svg'
import { FloatingActionButton } from '@/components/ui/FloatingActionButton'
import { TabBarMaterialBackground } from '@/components/ui/TabBarMaterialBackground'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { APP_ENV } from '@/lib/config'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { useFeatureFlag } from '@/lib/featureFlags'
import { canUseIosTabBarMaterial } from '@/lib/utils/iosTabMaterial'

const TAB_BAR_HEIGHT = 72

const HomeIcon = React.memo(function HomeIcon({ color }: { color: string }) {
  return (
    <Svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke={color}
    >
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Polyline points="9 22 9 12 15 12 15 22" />
    </Svg>
  )
})

const SearchIcon = React.memo(function SearchIcon({ color }: { color: string }) {
  return (
    <Svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke={color}
    >
      <Circle cx={11} cy={11} r={8} />
      <Line x1={21} y1={21} x2={16.65} y2={16.65} />
    </Svg>
  )
})

const SavedIcon = React.memo(function SavedIcon({ color }: { color: string }) {
  return (
    <Svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke={color}
    >
      <Path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
    </Svg>
  )
})

const PersonIcon = React.memo(function PersonIcon({ color }: { color: string }) {
  return (
    <Svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke={color}
    >
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx={12} cy={7} r={4} />
    </Svg>
  )
})

export default function TabLayout() {
  const router = useRouter()
  const colors = useThemeColors()
  const materialFlagEnabled = useFeatureFlag('iosTabBarMaterial')
  const materialEligible = canUseIosTabBarMaterial(Platform.OS, APP_ENV, materialFlagEnabled)

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.text3,
          tabBarStyle: {
            backgroundColor: materialEligible ? 'transparent' : colors.bg,
            borderTopColor: colors.border,
            borderTopWidth: spacing.hairline,
            height: TAB_BAR_HEIGHT,
            paddingBottom: spacing.px10,
            paddingTop: spacing[0],
            ...(materialEligible ? styles.materialTabBar : {}),
          },
          ...(materialEligible
            ? {
                sceneStyle: styles.materialScene,
                tabBarBackground: () => <TabBarMaterialBackground materialEnabled />,
              }
            : {}),
          tabBarLabelStyle: {
            fontSize: fontSize.sm,
            fontWeight: fontWeight.regular,
          },
        }}
      >
        <Tabs.Screen
          name="feed"
          options={{ title: 'Feed', tabBarIcon: ({ color }) => <HomeIcon color={color} /> }}
        />
        <Tabs.Screen
          name="search"
          options={{ title: 'Search', tabBarIcon: ({ color }) => <SearchIcon color={color} /> }}
        />
        <Tabs.Screen
          name="saved"
          options={{ title: 'Saved', tabBarIcon: ({ color }) => <SavedIcon color={color} /> }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: 'Profile', tabBarIcon: ({ color }) => <PersonIcon color={color} /> }}
        />
        <Tabs.Screen name="alerts" options={{ href: null }} />
        <Tabs.Screen name="post" options={{ href: null }} />
      </Tabs>
      {materialEligible ? (
        <View style={styles.fabContainer}>
          <FloatingActionButton
            accessibilityLabel="Create post"
            onPress={() => router.push('/post')}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" stroke={colors.bg}>
              <Line x1={12} y1={5} x2={12} y2={19} />
              <Line x1={5} y1={12} x2={19} y2={12} />
            </Svg>
          </FloatingActionButton>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fabContainer: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT / 2 - spacing.px28,
    alignSelf: 'center',
    zIndex: 10,
  },
  materialTabBar: {
    position: 'absolute',
  },
  materialScene: {
    paddingBottom: TAB_BAR_HEIGHT,
  },
})
