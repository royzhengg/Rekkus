import { useRouter } from 'expo-router'
import React from 'react'
import { Modal, Text, TouchableOpacity, View } from 'react-native'
import { BookmarkIcon } from '@/components/icons'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import type { ColorTokens } from '@/lib/contexts/ThemeContext'
import { routes } from '@/lib/routes'
import type { makeStyles } from './RestaurantDetailScreen.styles'
import type { PlaceDetail, PostSort } from './restaurantTypes'

type Notice = { title: string; subtitle?: string } | null

type Props = {
  styles: ReturnType<typeof makeStyles>
  colors: ColorTokens
  name: string
  address: string
  restaurantId: string | null
  detail: PlaceDetail | null
  saveSheet: boolean
  setSaveSheet: React.Dispatch<React.SetStateAction<boolean>>
  sortSheetVisible: boolean
  setSortSheetVisible: React.Dispatch<React.SetStateAction<boolean>>
  sortPosts: PostSort
  setSortPosts: React.Dispatch<React.SetStateAction<PostSort>>
  mapsSheetVisible: boolean
  setMapsSheetVisible: React.Dispatch<React.SetStateAction<boolean>>
  openSelectedMap: (provider: string) => void
  restaurantActionsSheetVisible: boolean
  setRestaurantActionsSheetVisible: React.Dispatch<React.SetStateAction<boolean>>
  handleRestaurantAction: (value: string) => void
  shareSheet: boolean
  setShareSheet: React.Dispatch<React.SetStateAction<boolean>>
  notice: Notice
  setNotice: React.Dispatch<React.SetStateAction<Notice>>
}

export function RestaurantDetailSheets({
  styles,
  colors,
  name,
  address,
  restaurantId,
  detail,
  saveSheet,
  setSaveSheet,
  sortSheetVisible,
  setSortSheetVisible,
  sortPosts,
  setSortPosts,
  mapsSheetVisible,
  setMapsSheetVisible,
  openSelectedMap,
  restaurantActionsSheetVisible,
  setRestaurantActionsSheetVisible,
  handleRestaurantAction,
  shareSheet,
  setShareSheet,
  notice,
  setNotice,
}: Props) {
  const router = useRouter()

  return (
    <>
      <Modal visible={saveSheet} transparent animationType="fade" onRequestClose={() => setSaveSheet(false)}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setSaveSheet(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetIcon}>
            <BookmarkIcon filled size={22} />
          </View>
          <Text style={styles.sheetTitle}>Saved!</Text>
          <Text style={styles.sheetBody}>{name} has been added to your places.</Text>
          <TouchableOpacity
            style={styles.sheetBtnPrimary}
            onPress={() => {
              setSaveSheet(false)
              router.push(routes.saved('places'))
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.sheetBtnPrimaryText}>View saved places</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetBtnSecondary} onPress={() => setSaveSheet(false)} activeOpacity={0.8}>
            <Text style={styles.sheetBtnSecondaryText}>Stay here</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <RekkusActionSheet
        visible={sortSheetVisible}
        title="Sort posts"
        options={[
          { label: 'Most liked', value: 'liked', selected: sortPosts === 'liked' },
          { label: 'Newest', value: 'newest', selected: sortPosts === 'newest' },
          { label: 'Oldest', value: 'oldest', selected: sortPosts === 'oldest' },
        ]}
        onSelect={value => setSortPosts(value as PostSort)}
        onDismiss={() => setSortSheetVisible(false)}
      />
      <RekkusActionSheet
        visible={mapsSheetVisible}
        title="Open in Maps"
        subtitle={name}
        options={[
          { label: 'Apple Maps', value: 'apple' },
          { label: 'Google Maps', value: 'google' },
        ]}
        onSelect={openSelectedMap}
        onDismiss={() => setMapsSheetVisible(false)}
      />
      <RekkusActionSheet
        visible={restaurantActionsSheetVisible}
        title="Improve this place"
        subtitle={name}
        options={[
          { label: 'Suggest an edit', value: 'suggest_edit' },
          { label: 'Report duplicate', value: 'report_duplicate' },
          { label: 'Verify details look right', value: 'verify_info' },
          { label: 'Claim this restaurant', value: 'claim_restaurant' },
        ]}
        onSelect={handleRestaurantAction}
        onDismiss={() => setRestaurantActionsSheetVisible(false)}
      />
      <RekkusActionSheet
        visible={shareSheet}
        title="Share place"
        options={[{ label: 'Send via message', value: 'send_dm' }]}
        onSelect={value => {
          setShareSheet(false)
          if (value === 'send_dm') {
            router.push(routes.messagePlaceShare({
              sharePlaceId: restaurantId ?? '',
              sharePlaceName: name,
              sharePlaceAddress: address ?? '',
              sharePlaceCuisine: detail?.types?.[0] ?? '',
            }))
          }
        }}
        onDismiss={() => setShareSheet(false)}
      />
      <RekkusActionSheet
        visible={notice != null}
        title={notice?.title}
        subtitle={notice?.subtitle}
        options={[{ label: 'OK', value: 'ok', accentColor: colors.accent }]}
        onSelect={() => {}}
        onDismiss={() => setNotice(null)}
      />
    </>
  )
}
