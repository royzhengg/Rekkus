import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useMemo } from 'react'
import { useRouter } from 'expo-router'
import { Svg, Polyline } from 'react-native-svg'
import { useThemeColors } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'

function ChevronLeft() {
  const colors = useThemeColors()
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.text2}
      strokeWidth={1.5}
      strokeLinecap="round"
    >
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  )
}

export default function SignupProfileScreen() {
  const router = useRouter()
  const { updateProfile } = useAuth()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [suburb, setSuburb] = useState('')
  const [city, setCity] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const canSubmit = username.trim().length >= 3 && displayName.trim().length >= 1

  const cleanUsername = username
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 30)

  async function handleFinish() {
    if (!canSubmit || loading) return
    setError('')
    setLoading(true)
    const err = await updateProfile(cleanUsername, displayName.trim())
    if (err) {
      setLoading(false)
      setError(err)
      return
    }
    const loc = { suburb: suburb.trim() || null, city: city.trim() || null }
    if (loc.suburb || loc.city) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) await (supabase.from('users') as any).update(loc).eq('id', user.id)
    }
    setLoading(false)
    router.replace('/(tabs)/feed')
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Your profile</Text>
          <Text style={styles.subtitle}>One last step.</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Text style={styles.label}>Username</Text>
          <View style={styles.usernameWrap}>
            <Text style={styles.atSign}>@</Text>
            <TextInput
              style={styles.usernameInput}
              placeholder="yourhandle"
              placeholderTextColor={colors.text3}
              value={username}
              onChangeText={t =>
                setUsername(
                  t
                    .toLowerCase()
                    .replace(/[^a-z0-9_.]/g, '')
                    .slice(0, 30)
                )
              }
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Text style={styles.hint}>Letters, numbers, _ and . only. Min 3 characters.</Text>

          <Text style={[styles.label, { marginTop: 16 }]}>Display name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={colors.text3}
            value={displayName}
            onChangeText={setDisplayName}
          />

          <Text style={[styles.label, { marginTop: 4 }]}>
            Suburb <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Surry Hills"
            placeholderTextColor={colors.text3}
            value={suburb}
            onChangeText={setSuburb}
            autoCapitalize="words"
          />

          <Text style={[styles.label, { marginTop: 4 }]}>
            City <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Sydney"
            placeholderTextColor={colors.text3}
            value={city}
            onChangeText={setCity}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleFinish}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
            onPress={handleFinish}
            disabled={!canSubmit || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.primaryBtnText}>Finish</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    topBar: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, marginLeft: -6 },
    backText: { fontSize: 14, color: c.text2 },
    scroll: { padding: 16, paddingTop: 28 },
    title: { fontSize: 26, fontWeight: '500', color: c.text, marginBottom: 4, letterSpacing: -0.3 },
    subtitle: { fontSize: 14, color: c.text2, marginBottom: 28 },
    errorText: {
      fontSize: 13,
      color: c.liked,
      backgroundColor: '#FEF0F0',
      borderRadius: 8,
      padding: 10,
      marginBottom: 16,
      lineHeight: 18,
    },
    label: { fontSize: 12, fontWeight: '500', color: c.text2, marginBottom: 6 },
    usernameWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      marginBottom: 6,
    },
    atSign: { fontSize: 14, color: c.text2, marginRight: 2 },
    usernameInput: { flex: 1, paddingVertical: 13, fontSize: 14, color: c.text },
    hint: { fontSize: 11, color: c.text3, marginBottom: 4 },
    input: {
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 14,
      color: c.text,
      marginBottom: 28,
    },
    primaryBtn: {
      backgroundColor: c.text,
      borderRadius: 20,
      paddingVertical: 15,
      alignItems: 'center',
    },
    primaryBtnDisabled: { opacity: 0.4 },
    primaryBtnText: { fontSize: 15, fontWeight: '500', color: c.bg },
    optional: { fontWeight: '400', color: c.text3 },
  })
}
