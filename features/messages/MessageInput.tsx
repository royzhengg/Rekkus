import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import React, { useRef, useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import {
  CameraIcon,
  CloseIcon,
  GalleryIcon,
  MapPinIcon,
  PaperclipIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
} from '@/components/icons'
import { CachedImage } from '@/components/ui/CachedImage'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { radius } from '@/constants/Radius'
import { spacing } from '@/constants/Spacing'
import { fontSize } from '@/constants/Typography'
import { SPRING_SNAPPY, PRESS_SCALE_ICON } from '@/lib/animations'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import type { useThemeColors } from '@/lib/contexts/ThemeContext'
import { isEnabled } from '@/lib/featureFlags'
import { usePermissionRecovery } from '@/lib/hooks/usePermissionRecovery'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import { hasGifProvider, type GifResult } from '@/lib/services/gifs'
import { validatePickedMessageAttachment } from '@/lib/services/media'
import { uploadAttachment, computeFileHash } from '@/lib/services/messageAttachments'
import { sendRichMessage, type DirectMessage, type MessageType } from '@/lib/services/messaging'
import { moderateMessageMedia } from '@/lib/services/moderation'
import { fetchSavedLocationsForUser, type SavedLocationWithRestaurant } from '@/lib/services/restaurants'
import { richTypePreview } from './MessageBubble'
import { makeMessageInputStyles } from './MessageInput.styles'
import { useMessageGifPicker } from './useMessageGifPicker'

export type MessageInputHandle = {
  focus: () => void
}
interface MessageInputProps {
  conversationId: string
  currentUserId: string
  replyingTo: DirectMessage | null
  onClearReply: () => void
  onMessageSent: (msg: DirectMessage) => void
  onScrollToEnd: () => void
  onShowError: (error: { title: string; message: string }) => void
  onTyping?: () => void
  colors: ReturnType<typeof useThemeColors>
}
export const MessageInput = forwardRef<MessageInputHandle, MessageInputProps>(function MessageInput(
  { conversationId, currentUserId, replyingTo, onClearReply, onMessageSent, onScrollToEnd, onShowError, onTyping, colors },
  ref
) {
  const { requireOnline } = useConnectivity()
  const inputRef = useRef<TextInput>(null)
  const styles = useMemo(() => makeMessageInputStyles(colors), [colors])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [attachmentTrayOpen, setAttachmentTrayOpen] = useState(false)
  const [locationSheet, setLocationSheet] = useState(false)
  const gif = useMessageGifPicker()
  const [savedPlacePickerVisible, setSavedPlacePickerVisible] = useState(false)
  const [savedPlaces, setSavedPlaces] = useState<SavedLocationWithRestaurant[]>([])
  const [loadingSavedPlaces, setLoadingSavedPlaces] = useState(false)
  const { request: requestPermission, recoveryVisible, recoveryMessage, dismissRecovery, openSettings } = usePermissionRecovery()
  const reduceMotion = useReducedMotion()
  const sendScale = useSharedValue(1)
  const sendAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }))
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }))
  async function handleSend() {
    if (!conversationId || !currentUserId || sending) return
    const text = input.trim()
    if (!text) return
    if (!requireOnline()) {
      onShowError({ title: 'You are offline', message: 'Reconnect to send this message. Your text is still here.' })
      return
    }
    setAttachmentTrayOpen(false)
    setSending(true)
    setInput('')
    const replyId = replyingTo?.id ?? null
    onClearReply()

    const { message, error: sendError } = await sendRichMessage(conversationId, currentUserId, 'text', text, null, null, replyId)
    if (sendError || !message) {
      setInput(text)
      onShowError({ title: 'Message not sent', message: sendError ?? 'Messaging is not available right now.' })
    } else {
      onMessageSent(message)
      onScrollToEnd()
    }
    setSending(false)
  }
  async function handlePickMedia() {
    setAttachmentTrayOpen(false)
    const permission = await requestPermission(
      () => ImagePicker.requestMediaLibraryPermissionsAsync(),
      'Photo library access is needed to share images. Enable it in Settings.'
    )
    if (!permission.granted) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      videoMaxDuration: 60,
      allowsEditing: false,
    })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    const { uri, mimeType, error } = validatePickedMessageAttachment(asset)
    if (!uri || !mimeType) {
      onShowError({ title: 'Unsupported media', message: error ?? 'File not supported.' })
      return
    }
    if (asset.type === 'video' || asset.mimeType?.startsWith('video/')) {
      await sendMedia(uri, mimeType, 'video')
      return
    }
    await sendMedia(uri, mimeType, 'image')
  }
  async function handleCamera() {
    try {
      const permission = await requestPermission(
        () => ImagePicker.requestCameraPermissionsAsync(),
        'Camera access is needed to take a photo. Enable it in Settings.'
      )
      if (!permission.granted) return
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      if (result.canceled || !result.assets[0]) return
      const { uri, mimeType, error } = validatePickedMessageAttachment(result.assets[0])
      if (!uri || !mimeType) {
        onShowError({ title: 'Unsupported image', message: error ?? 'File not supported.' })
        return
      }
      await sendMedia(uri, mimeType, 'image')
    } catch (e) {
      const msg = (e as Error)?.message ?? ''
      if (msg.includes('not available') || msg.includes('simulator') || msg.includes('Camera')) {
        onShowError({ title: 'Camera unavailable', message: 'Camera is not available on this device.' })
      } else {
        onShowError({ title: 'Camera error', message: 'Could not open camera. Please try again.' })
      }
    }
  }

  async function handlePickFile() {
    setAttachmentTrayOpen(false)
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    await sendMedia(asset.uri, asset.mimeType ?? 'application/octet-stream', 'file')
  }

  async function openGifPicker() { setAttachmentTrayOpen(false); await gif.open() }

  async function handleSelectGif(gifItem: GifResult) {
    if (!conversationId || !currentUserId) return
    if (!requireOnline()) {
      onShowError({ title: 'You are offline', message: 'Reconnect to send this GIF.' })
      return
    }
    gif.setVisible(false)
    setSending(true)
    const { message, error } = await sendRichMessage(
      conversationId,
      currentUserId,
      'gif',
      null,
      gifItem.url,
      { title: gifItem.title, preview_url: gifItem.previewUrl, provider: 'giphy' },
      replyingTo?.id ?? null
    )
    if (error || !message) {
      onShowError({ title: 'Could not send GIF', message: error ?? 'GIFs are not available right now.' })
    } else {
      onMessageSent(message)
      onClearReply()
      onScrollToEnd()
    }
    setSending(false)
  }

  async function handleLocationSheetSelect(value: string) {
    setLocationSheet(false)
    if (value === 'current_location') {
      await doShareCurrentLocation()
    } else if (value === 'saved_place') {
      setSavedPlacePickerVisible(true)
      setLoadingSavedPlaces(true)
      const places = await fetchSavedLocationsForUser(currentUserId).catch(() => [])
      setSavedPlaces(places)
      setLoadingSavedPlaces(false)
    }
  }

  async function doShareCurrentLocation() {
    if (!requireOnline()) {
      onShowError({ title: 'You are offline', message: 'Reconnect to share your location.' })
      return
    }
    try {
      const permission = await requestPermission(
        () => Location.requestForegroundPermissionsAsync(),
        'Location access is needed to share your current position. Enable it in Settings.'
      )
      if (!permission.granted) return
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const { message, error } = await sendRichMessage(conversationId, currentUserId, 'location', null, null, {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        label: 'My location',
      })
      if (error) {
        onShowError({ title: 'Could not share location', message: error })
      } else if (message) {
        onMessageSent(message)
        onScrollToEnd()
      }
    } catch {
      onShowError({ title: 'Location error', message: 'Could not get your current location. Please try again.' })
    }
  }

  async function handleSavedPlaceSelect(place: SavedLocationWithRestaurant) {
    setSavedPlacePickerVisible(false)
    if (!place.restaurants) return
    if (!requireOnline()) {
      onShowError({ title: 'You are offline', message: 'Reconnect to share this place.' })
      return
    }
    const { name, address, latitude, longitude, google_place_id } = place.restaurants
    const { message, error } = await sendRichMessage(conversationId, currentUserId, 'place_share', null, null, {
      name,
      address,
      lat: latitude,
      lng: longitude,
      restaurant_id: place.restaurant_id,
      google_place_id,
    })
    if (error) {
      onShowError({ title: 'Could not share place', message: error })
    } else if (message) {
      onMessageSent(message)
      onScrollToEnd()
    }
  }

  async function sendMedia(uri: string, mimeType: string, msgType: MessageType) {
    if (!requireOnline()) {
      onShowError({ title: 'You are offline', message: 'Reconnect to send this attachment.' })
      return
    }
    setAttachmentTrayOpen(false)
    setSending(true)
    try {
      if (msgType === 'image' || msgType === 'video') {
        try {
          const hash = await computeFileHash(uri)
          const safe = await moderateMessageMedia(hash, msgType, conversationId)
          if (!safe) {
            onShowError({ title: 'Could not send', message: 'This content could not be sent.' })
            return
          }
        } catch {
          // Moderation service unavailable — allow send rather than blocking the user
        }
      }

      const { url, error: uploadError } = await uploadAttachment(conversationId, currentUserId, uri, mimeType)
      if (uploadError) {
        onShowError({ title: 'Upload failed', message: uploadError })
        return
      }

      const meta = msgType === 'file'
        ? { filename: uri.split('/').pop() ?? 'file', mimeType }
        : undefined

      const { message: sentMessage, error: richError } = await sendRichMessage(
        conversationId, currentUserId, msgType, null, url, meta ?? null, replyingTo?.id ?? null
      )
      if (richError || !sentMessage) {
        onShowError({ title: 'Could not send', message: richError ?? 'Messaging is not available right now.' })
      } else {
        onMessageSent(sentMessage)
        onScrollToEnd()
      }
      onClearReply()
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Reply context bar */}
      {replyingTo ? (
        <Animated.View {...(!reduceMotion ? { entering: FadeInDown.duration(180) } : {})} style={styles.replyBar}>
          <View style={styles.replyBarAccent} />
          <View style={styles.replyBarContent}>
            <Text style={styles.replyBarLabel}>Replying to</Text>
            <Text style={styles.replyBarText} numberOfLines={1}>
              {replyingTo.body ?? richTypePreview(replyingTo)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClearReply}
            accessibilityRole="button"
            accessibilityLabel="Cancel reply"
          >
            <CloseIcon size={16} color={colors.text3} />
          </TouchableOpacity>
        </Animated.View>
      ) : null}

      {/* Input area */}
      <View style={styles.inputArea}>
        {attachmentTrayOpen ? (
          <Animated.View {...(!reduceMotion ? { entering: FadeInDown.duration(150) } : {})} style={styles.attachmentTray}>
            <TouchableOpacity style={styles.trayAction} onPress={handlePickMedia} activeOpacity={0.74}>
              <View style={styles.trayIconWrap}>
                <GalleryIcon size={21} color={colors.accent} />
              </View>
              <Text style={styles.trayActionLabel}>Media</Text>
            </TouchableOpacity>
            {isEnabled('gifSearch') && (
              <TouchableOpacity style={styles.trayAction} onPress={openGifPicker} activeOpacity={0.74} accessibilityRole="button">
                <View style={styles.trayIconWrap}>
                  <Text style={styles.gifTrayIcon}>GIF</Text>
                </View>
                <Text style={styles.trayActionLabel}>GIF</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.trayAction} onPress={() => { setAttachmentTrayOpen(false); setLocationSheet(true) }} activeOpacity={0.74}>
              <View style={styles.trayIconWrap}>
                <MapPinIcon size={21} color={colors.accent} />
              </View>
              <Text style={styles.trayActionLabel}>Location</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.trayAction} onPress={handlePickFile} activeOpacity={0.74}>
              <View style={styles.trayIconWrap}>
                <PaperclipIcon size={21} color={colors.accent} />
              </View>
              <Text style={styles.trayActionLabel}>File</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : null}
        <View style={styles.composeRow}>
          <TouchableOpacity
            style={[styles.attachBtn, attachmentTrayOpen && styles.attachBtnActive]}
            onPress={() => setAttachmentTrayOpen(open => !open)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={attachmentTrayOpen ? 'Close attachment options' : 'Open attachment options'}
          >
            <PlusIcon size={20} color={colors.text2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={handleCamera}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open camera"
          >
            <CameraIcon size={20} color={colors.text2} />
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={input}
            onChangeText={text => { setInput(text); onTyping?.() }}
            placeholder="Message"
            placeholderTextColor={colors.text3}
            multiline
            maxLength={2000}
            returnKeyType="default"
            textContentType="none"
            autoComplete="off"
            onFocus={() => { setAttachmentTrayOpen(false); onScrollToEnd() }}
          />
          <Animated.View style={sendAnimStyle}>
            <TouchableOpacity
              style={[styles.sendBtn, input.trim() ? styles.sendBtnActive : styles.sendBtnInactive]}
              onPress={handleSend}
              onPressIn={() => { if (input.trim() && !reduceMotion) sendScale.value = withSpring(PRESS_SCALE_ICON, SPRING_SNAPPY) }}
              onPressOut={() => { if (!reduceMotion) sendScale.value = withSpring(1, SPRING_SNAPPY) }}
              disabled={!input.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              activeOpacity={1}
            >
              {sending
                ? <ActivityIndicator size="small" color={input.trim() ? colors.white : colors.text3} />
                : <SendIcon active={!!input.trim()} color={input.trim() ? colors.white : undefined} />}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>

      {/* Location action sheet */}
      <RekkusActionSheet
        visible={locationSheet}
        title="Share location"
        options={[
          { label: 'Current location', value: 'current_location', icon: <MapPinIcon size={18} color={colors.text} /> },
          { label: 'Share a saved place', value: 'saved_place', icon: <GalleryIcon size={18} color={colors.text} /> },
        ]}
        onSelect={handleLocationSheetSelect}
        onDismiss={() => setLocationSheet(false)}
      />

      {/* GIF picker modal */}
      <Modal
        visible={gif.visible}
        transparent
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={() => gif.setVisible(false)}
      >
        <View style={styles.pickerOverlay}>
          <TouchableOpacity
            style={styles.pickerDismiss}
            onPress={() => gif.setVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close GIF picker"
          />
          <View style={styles.gifSheet}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>GIFs</Text>
              <TouchableOpacity
                onPress={() => gif.setVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close GIF picker"
              >
                <CloseIcon size={18} color={colors.text3} />
              </TouchableOpacity>
            </View>
            <View style={styles.gifSearchWrap}>
              <SearchIcon size={14} color={colors.text3} />
              <TextInput
                style={styles.gifSearchInput}
                value={gif.query}
                onChangeText={gif.search}
                placeholder="Search GIFs"
                placeholderTextColor={colors.text3}
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                spellCheck={false}
                returnKeyType="search"
              />
            </View>
            {!hasGifProvider() ? (
              <View style={styles.gifState}>
                <Text style={styles.gifStateTitle}>GIFs need setup</Text>
                <Text style={styles.gifStateBody}>Add the platform GIPHY key to enable GIF search.</Text>
              </View>
            ) : gif.loading ? (
              <ActivityIndicator color={colors.text3} style={{ marginVertical: spacing.px28 }} />
            ) : gif.error ? (
              <View style={styles.gifState}>
                <ErrorMessage title="Could not load GIFs" message={gif.error} />
              </View>
            ) : (
              <FlatList
                data={gif.results}
                keyExtractor={item => item.id}
                numColumns={2}
                columnWrapperStyle={styles.gifGridRow}
                contentContainerStyle={styles.gifGrid}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={styles.gifState}>
                    <Text style={styles.gifStateTitle}>No GIFs found</Text>
                    <Text style={styles.gifStateBody}>Try another search.</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.gifTile}
                    onPress={() => handleSelectGif(item)}
                    activeOpacity={0.82}
                  >
                    <CachedImage source={{ uri: item.previewUrl }} style={styles.gifTileImage} />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Permission recovery sheet — shown when a permission is permanently denied (canAskAgain false) */}
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

      {/* Saved place picker modal */}
      <Modal
        visible={savedPlacePickerVisible}
        transparent
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={() => setSavedPlacePickerVisible(false)}
      >
        <View style={styles.pickerOverlay}>
          <TouchableOpacity
            style={styles.pickerDismiss}
            onPress={() => setSavedPlacePickerVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close saved place picker"
          />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Share a place</Text>
              <TouchableOpacity
                onPress={() => setSavedPlacePickerVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close saved place picker"
              >
                <CloseIcon size={18} color={colors.text3} />
              </TouchableOpacity>
            </View>
            {loadingSavedPlaces ? (
              <>
                {Array.from({ length: 3 }).map((_, i) => (
                  <View key={i} style={styles.placeRow}>
                    <Skeleton width={36} height={36} radius={radius.xl} />
                    <View style={{ flex: 1, gap: spacing[2] }}>
                      <Skeleton width="70%" height={14} />
                      <Skeleton width="50%" height={12} />
                    </View>
                  </View>
                ))}
              </>
            ) : savedPlaces.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing[8] }}>
                <Text style={{ color: colors.text3, fontSize: fontSize.md }}>No saved places yet</Text>
              </View>
            ) : (
              <FlatList
                data={savedPlaces}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingBottom: spacing[8] }}
                renderItem={({ item }) => {
                  const r = item.restaurants
                  if (!r) return null
                  return (
                    <TouchableOpacity
                      style={styles.placeRow}
                      onPress={() => handleSavedPlaceSelect(item)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.placeRowIcon, { backgroundColor: colors.accent + '18' }]}>
                        <MapPinIcon size={16} color={colors.accent} />
                      </View>
                      <View style={styles.placeRowText}>
                        <Text style={styles.placeRowName} numberOfLines={1}>{r.name}</Text>
                        {r.address ? (
                          <Text style={styles.placeRowAddr} numberOfLines={1}>{r.address}</Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  )
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  )
})
