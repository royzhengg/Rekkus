import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import React, { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, CameraIcon } from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize, fontWeight } from '@/constants/Typography'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { usePermissionRecovery } from '@/lib/hooks/usePermissionRecovery'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { uploadAvatarImage, validatePickedAvatarImage } from '@/lib/services/media'
import { fetchProfile, updateProfile as updateUserProfile } from '@/lib/services/users'

export default function EditProfileScreen() {
  const router = useRouter()
  const { user, updateProfile: updateAuthProfile } = useAuth()
  const { requireOnline } = useConnectivity()
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
  const [error, setError] = useState<string | null>(null)
  const { request: requestPermission, recoveryVisible, recoveryMessage, dismissRecovery, openSettings } = usePermissionRecovery()

  useEffect(() => {
    if (!user) return
    void fetchProfile(user.id)
      .then(data => {
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
    setError(null)
    const permission = await requestPermission(
      () => ImagePicker.requestMediaLibraryPermissionsAsync(),
      'Photo library access is needed to update your avatar. Enable it in Settings.'
    )
    if (!permission.granted) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      const validatedUri = validatePickedAvatarImage(result.assets[0])
      if (!validatedUri) {
        analytics.uploadFailure(user?.id ?? null, 'avatar_picker', 'validation_rejected', 1)
        setError('Choose a JPEG, PNG, or WebP image under 5 MB.')
        return
      }
      setAvatarUri(validatedUri)
    }
  }

  async function uploadAvatar(uri: string): Promise<string | null> {
    if (!user) return null
    setUploading(true)
    try {
      return await uploadAvatarImage(user.id, uri)
    } catch (error) {
      analytics.uploadFailure(user.id, 'avatar_upload', 'storage_upload_error')
      setError(error instanceof Error ? error.message : 'Please try again.')
      return null
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!user) return
    setError(null)
    if (!requireOnline()) {
      setError('Reconnect to update your profile.')
      return
    }
    setLoading(true)
    let finalAvatarUrl = avatarUrl
    if (avatarUri) finalAvatarUrl = await uploadAvatar(avatarUri)
    const cleanUsername = username
      .toLowerCase()
      .replace(/[^a-z0-9_.]/g, '')
      .slice(0, 30)
    const error = await updateAuthProfile(cleanUsername, displayName)
    if (error) {
      setError(error)
      setLoading(false)
      return
    }
    try {
      await updateUserProfile(user.id, {
        bio,
        avatar_url: finalAvatarUrl,
        suburb: suburb.trim() || null,
        city: city.trim() || null,
        country: country.trim() || null,
      })
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : 'Could not update profile.')
      setLoading(false)
      return
    }
    setLoading(false)
    router.back()
  }

  const canSave = username.trim().length > 0 && displayName.trim().length > 0
  const avatarSourceUri = avatarUri ?? avatarUrl

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft />
        </TouchableOpacity>
        <Text style={styles.title}>Edit profile</Text>
        <TouchableOpacity
          style={[styles.saveBtn, (!canSave || loading || uploading) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave || loading || uploading}
          accessibilityRole="button"
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
            {avatarSourceUri ? (
              <CachedImage source={{ uri: avatarSourceUri }} style={styles.avatar} />
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
                <Text style={{ fontSize: fontSize['6xl'], color: colors.text3 }}>
                  {displayName.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.cameraOverlay}>
              <CameraIcon color={colors.white} />
            </View>
          </TouchableOpacity>
          <Text style={styles.changePhotoText}>Change photo</Text>
        </View>

        <View style={styles.form}>
          {error ? <ErrorMessage title="Could not update profile" message={error} /> : null}
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
                textContentType="username"
                autoComplete="username"
                returnKeyType="next"
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
              textContentType="name"
              autoComplete="name"
              autoCapitalize="words"
              returnKeyType="next"
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
              textContentType="none"
              autoComplete="off"
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
              textContentType="addressCity"
              autoComplete="address-line2"
              returnKeyType="next"
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
              textContentType="addressCity"
              autoComplete="address-line2"
              returnKeyType="next"
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
              textContentType="countryName"
              autoComplete="country"
              returnKeyType="done"
            />
          </View>
        </View>
      </ScrollView>

      <RekkusActionSheet
        visible={recoveryVisible}
        title="Permission required"
        subtitle={recoveryMessage}
        options={[
          { label: 'Open Settings', value: 'settings', accentColor: colors.accent },
          { label: 'Not now', value: 'cancel' },
        ]}
        onSelect={v => v === 'settings' ? openSettings() : dismissRecovery()}
        onDismiss={dismissRecovery}
      />
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
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBtn: { width: 56, alignItems: 'flex-start' },
    title: { flex: 1, textAlign: 'center', fontSize: fontSize.lg, fontWeight: fontWeight.medium, color: c.text },
    saveBtn: { width: 56, alignItems: 'flex-end', justifyContent: 'center' },
    saveBtnDisabled: { opacity: 0.4 },
    saveBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.accent },
    avatarSection: { alignItems: 'center', paddingTop: spacing.px28, paddingBottom: spacing[5] },
    avatarWrap: { position: 'relative' },
    avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
    cameraOverlay: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 28,
      height: 28,
      borderRadius: radius.lg,
      backgroundColor: c.text,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: c.bg,
    },
    changePhotoText: { marginTop: spacing.px10, fontSize: fontSize.base, color: c.info },
    form: { paddingHorizontal: spacing[4], gap: spacing[5], paddingBottom: spacing.px40 },
    fieldGroup: { gap: spacing.px6 },
    label: { fontSize: fontSize.bodySm, fontWeight: fontWeight.medium, color: c.text2 },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing[3],
    },
    atPrefix: { fontSize: fontSize.md, color: c.text2, marginRight: spacing.px2 },
    input: {
      backgroundColor: c.surface,
      borderRadius: radius.md3,
      paddingHorizontal: spacing.px14,
      paddingVertical: spacing[3],
      fontSize: fontSize.md,
      color: c.text,
    },
    bioInput: { height: 90, textAlignVertical: 'top', paddingTop: spacing[3] },
    charCount: { fontSize: fontSize.sm, color: c.text3, textAlign: 'right' },
  })
}
