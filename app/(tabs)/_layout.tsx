import { Tabs } from 'expo-router'
import React from 'react'
import { Svg, Circle, Path, Polyline, Line } from 'react-native-svg'
import { TabBarPostButton } from '@/components/TabBarPostButton'
import { useThemeColors } from '@/lib/contexts/ThemeContext'

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
  const colors = useThemeColors()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.text3,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          height: 72,
          paddingBottom: 10,
          paddingTop: 0,
        },
        tabBarLabelStyle: {
          fontSize: 9.5,
          fontWeight: '400',
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
        name="create"
        options={{ title: '', tabBarButton: props => <TabBarPostButton {...props} /> }}
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
      <Tabs.Screen name="places" options={{ href: null }} />
      <Tabs.Screen name="restaurants" options={{ href: null }} />
    </Tabs>
  )
}
