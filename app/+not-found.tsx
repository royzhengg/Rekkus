import { Link, Stack } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { useThemeColors } from '@/lib/ThemeContext'

export default function NotFoundScreen() {
  const c = useThemeColors()
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={[styles.title, { color: c.text }]}>This screen doesn't exist.</Text>
        <Link href="/(tabs)/feed" style={styles.link}>
          <Text style={{ fontSize: 14, color: c.accent }}>Go to home screen!</Text>
        </Link>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold' },
  link: { marginTop: 15, paddingVertical: 15 },
})
