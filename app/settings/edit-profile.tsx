import React, { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useThemeColors } from '@/lib/ThemeContext'
import { ArrowLeft, CameraIcon } from '@/components/icons'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'

export default function EditProfileScreen() {
  const router = useRouter()
  const { user, updateProfile } = useAuth()
  const colors = useThemeColors()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [suburb, setSuburb] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!user) return
    ;(supabase.from('users') as any)
      .select('username, full_name, bio, avatar_url, suburb, city, country')
      .eq('id', user.id)
      .single()
      .then(({ data }: any) => {
        if (data) {
          setUsername(data.username ?? '')
          setDisplayName(data.full_name ?? '')
          setBio(data.bio ?? '')
          setSuburb(data.suburb ?? '')
          setCity(data.city ?? '')
          setCountry(data.country ?? '')
          setAvatarUrl(data.avatar_url ?? null)
        }
      })
  }, [user])

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo library access to update your avatar.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri)
    }
  }

  async function uploadAvatar(uri: string): Promise<string | null> {
    if (!user) return null
    setUploading(true)
    const ext = uri.split('.').pop() ?? 'jpg'
    const path = `${user.id}/avatar.${ext}`
    const response = await fetch(uri)
    const blob = await response.blob()
    const arrayBuffer = await new Response(blob).arrayBuffer()
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, arrayBuffer, { contentType: `image/${ext}`, upsert: true })
    setUploading(false)
    if (error) {
      Alert.alert('Upload failed', error.message)
      return null
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSave() {
    if (!user) return
    setLoading(true)
    let finalAvatarUrl = avatarUrl
    if (avatarUri) finalAvatarUrl = await uploadAvatar(avatarUri)
    const cleanUsername = username
      .toLowerCase()
      .replace(/[^a-z0-9_.]/g, '')
      .slice(0, 30)
    const error = await updateProfile(cleanUsername, displayName)
    if (error) {
      Alert.alert('Error', error)
      setLoading(false)
      return
    }
    await (supabase.from('users') as any)
      .update({
        bio,
        avatar_url: finalAvatarUrl,
        suburb: suburb.trim() || null,
        city: city.trim() || null,
        country: country.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
    setLoading(false)
    router.back()
  }

  const canSave = username.trim().length > 0 && displayName.trim().length > 0

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft />
        </TouchableOpacity>
        <Text style={styles.title}>Edit profile</Text>
        <TouchableOpacity
          style={[styles.saveBtn, (!canSave || loading || uploading) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave || loading || uploading}
        >
          {loading || uploading ? (
            <ActivityIndicator size="small" color={colors.bg} />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} style={styles.avatarWrap}>
            {avatarUri || avatarUrl ? (
              <Image source={{ uri: avatarUri ?? avatarUrl! }} style={styles.avatar} />
            ) : (
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: colors.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                ]}
              >
                <Text style={{ fontSize: 28, color: colors.text3 }}>
                  {displayName.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.cameraOverlay}>
              <CameraIcon color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.changePhotoText}>Change photo</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Username</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.atPrefix}>@</Text>
              <TextInput
                style={[styles.input, { flex: 1, backgroundColor: 'transparent' }]}
                value={username}
                onChangeText={t =>
                  setUsername(
                    t
                      .toLowerCase()
                      .replace(/[^a-z0-9_.]/g, '')
                      .slice(0, 30)
                  )
                }
                placeholder="username"
                placeholderTextColor={colors.text3}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Display name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor={colors.text3}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell people about yourself…"
              placeholderTextColor={colors.text3}
              multiline
              maxLength={150}
            />
            <Text style={styles.charCount}>{bio.length}/150</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Suburb</Text>
            <TextInput
              style={styles.input}
              value={suburb}
              onChangeText={setSuburb}
              placeholder="Surry Hills"
              placeholderTextColor={colors.text3}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="Sydney"
              placeholderTextColor={colors.text3}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Country</Text>
            <TextInput
              style={styles.input}
              value={country}
              onChangeText={setCountry}
              placeholder="Australia"
              placeholderTextColor={colors.text3}
              autoCapitalize="words"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const AVATAR_SIZE = 88

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
    backBtn: { width: 56, alignItems: 'flex-start' },
    title: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '500', color: c.text },
    saveBtn: { width: 56, alignItems: 'flex-end', justifyContent: 'center' },
    saveBtnDisabled: { opacity: 0.4 },
    saveBtnText: { fontSize: 14, fontWeight: '600', color: c.accent },
    avatarSection: { alignItems: 'center', paddingTop: 28, paddingBottom: 20 },
    avatarWrap: { position: 'relative' },
    avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
    cameraOverlay: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.text,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: c.bg,
    },
    changePhotoText: { marginTop: 10, fontSize: 13, color: c.info },
    form: { paddingHorizontal: 16, gap: 20, paddingBottom: 40 },
    fieldGroup: { gap: 6 },
    label: { fontSize: 12, fontWeight: '500', color: c.text2 },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    atPrefix: { fontSize: 14, color: c.text2, marginRight: 2 },
    input: {
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: c.text,
    },
    bioInput: { height: 90, textAlignVertical: 'top', paddingTop: 12 },
    charCount: { fontSize: 11, color: c.text3, textAlign: 'right' },
  })
}
