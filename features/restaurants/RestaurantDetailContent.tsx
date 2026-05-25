import { useRouter } from 'expo-router'
import React from 'react'
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import {
  ChevronDown,
  ClockIcon,
  GlobeIcon,
  ImagePlaceholder,
  PhoneIcon,
  PinIcon,
  SortIcon,
} from '@/components/icons'
import { OpenBadge } from '@/components/OpenBadge'
import { Dollars, PostRatingStrip, Stars, Vibes } from '@/components/RatingDisplay'
import { CachedImage } from '@/components/ui/CachedImage'
import { Chip } from '@/components/ui/Chip'
import { imgColors } from '@/constants/Colors'
import { spacing } from '@/constants/Spacing'
import type { ColorTokens } from '@/lib/contexts/ThemeContext'
import { routes } from '@/lib/routes'
import type { Post } from '@/types/domain'
import {
  formatCategory,
  formatPriceLevel,
  PHOTO_HEIGHT,
  SORT_LABELS,
  type PlaceDetail,
  type PostSort,
} from './restaurantTypes'
import type { makeStyles } from './RestaurantDetailScreen.styles'

type Props = {
  styles: ReturnType<typeof makeStyles>
  colors: ColorTokens
  refreshing: boolean
  refresh: () => void
  photoUrls: string[]
  width: number
  detail: PlaceDetail | null
  name: string
  address: string
  openNow?: boolean | undefined
  hasGoogleRating: boolean
  hasRekkusRatings: boolean
  rekkusRatings: { food: number | null; vibe: number | null; cost: number | null }
  contextPosts: Post[]
  hasRecentReviews: boolean
  topDishes: Array<{ name: string; dishId?: string | undefined }>
  openAddress: () => void
  openPhone: (phone: string) => void
  openWebsite: (url: string) => void
  weekdayText: string[]
  hoursExpanded: boolean
  setHoursExpanded: React.Dispatch<React.SetStateAction<boolean>>
  todayIdx: number
  todayText?: string | undefined
  popularDishes: { name: string; count: number }[]
  sortedPosts: Post[]
  sortPosts: PostSort
  openSortSheet: () => void
  openRestaurantActions: () => void
  onPhotoPress: (index: number) => void
}

export function RestaurantDetailContent({
  styles,
  colors,
  refreshing,
  refresh,
  photoUrls,
  width,
  detail,
  name,
  address,
  openNow,
  hasGoogleRating,
  hasRekkusRatings,
  rekkusRatings,
  contextPosts,
  hasRecentReviews,
  topDishes,
  openAddress,
  openPhone,
  openWebsite,
  weekdayText,
  hoursExpanded,
  setHoursExpanded,
  todayIdx,
  todayText,
  popularDishes,
  sortedPosts,
  sortPosts,
  openSortSheet,
  openRestaurantActions,
  onPhotoPress,
}: Props) {
  const router = useRouter()
  const googleRating = detail?.rating
  const googleReviewCount = detail?.user_ratings_total
  const phoneNumber = detail?.formatted_phone_number
  const website = detail?.website

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text} />
      }
    >
      {photoUrls.length > 0 ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ height: PHOTO_HEIGHT }}>
          {photoUrls.map((url, i) => (
            <TouchableOpacity key={i} activeOpacity={0.9} onPress={() => onPhotoPress(i)}>
              <CachedImage source={{ uri: url }} style={{ width, height: PHOTO_HEIGHT }} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.photoPlaceholder, { width }]}>
          <ImagePlaceholder size={20} />
          <Text style={styles.photoPlaceholderText}>No images available</Text>
        </View>
      )}

      <View style={styles.infoSection}>
        <Text style={styles.placeName}>{name}</Text>
        <View style={styles.metaRow}>
          {!!formatCategory(detail?.types) && <Text style={styles.metaText}>{formatCategory(detail?.types)}</Text>}
          {detail?.price_level != null && (
            <>
              {!!formatCategory(detail?.types) && <Text style={styles.metaDot}>·</Text>}
              <Text style={styles.metaText}>{formatPriceLevel(detail.price_level)}</Text>
            </>
          )}
          {openNow != null && (
            <>
              <Text style={styles.metaDot}>·</Text>
              <OpenBadge openNow={openNow} />
            </>
          )}
        </View>

        <TouchableOpacity style={styles.improveButton} onPress={openRestaurantActions} activeOpacity={0.78}>
          <Text style={styles.improveButtonText}>Improve this place</Text>
        </TouchableOpacity>

        {(hasGoogleRating || hasRekkusRatings) && (
          <View style={styles.ratingsCard}>
            {hasGoogleRating && googleRating != null && (
              <View style={styles.ratingsCardRow}>
                <Text style={styles.ratingsCardLabel}>Google</Text>
                <View style={styles.ratingsCardValues}>
                  <Text style={styles.ratingEmoji}>⭐</Text>
                  <Text style={styles.ratingValue}>{googleRating.toFixed(1)}</Text>
                  {googleReviewCount != null && (
                    <Text style={styles.ratingCount}>{googleReviewCount.toLocaleString()} reviews</Text>
                  )}
                </View>
              </View>
            )}
            {hasGoogleRating && hasRekkusRatings && <View style={styles.ratingsCardDivider} />}
            {hasRekkusRatings && (
              <View style={styles.ratingsCardRow}>
                <Text style={styles.ratingsCardLabel}>Rekkus</Text>
                <View style={styles.ratingsCardValues}>
                  {rekkusRatings.food != null && (
                    <View style={styles.ratingChip}>
                      <Text style={styles.ratingChipLabel}>FOOD</Text>
                      <Stars count={Math.round(rekkusRatings.food)} size={12} />
                    </View>
                  )}
                  {rekkusRatings.vibe != null && (
                    <View style={styles.ratingChip}>
                      <Text style={styles.ratingChipLabel}>VIBE</Text>
                      <Vibes count={Math.round(rekkusRatings.vibe)} size={12} />
                    </View>
                  )}
                  {rekkusRatings.cost != null && (
                    <View style={styles.ratingChip}>
                      <Text style={styles.ratingChipLabel}>COST</Text>
                      <Dollars count={Math.round(rekkusRatings.cost)} size={11} />
                    </View>
                  )}
                  {contextPosts.length > 0 && (
                    <Text style={styles.ratingCount}>
                      {contextPosts.length} post{contextPosts.length !== 1 ? 's' : ''}
                    </Text>
                  )}
                </View>
              </View>
            )}
            {hasRekkusRatings && hasRecentReviews && <Text style={styles.recentReviewsNote}>(based on recent reviews)</Text>}
            {topDishes.length > 0 && (
              <>
                {(hasGoogleRating || hasRekkusRatings) && <View style={styles.ratingsCardDivider} />}
                <View style={styles.ratingsCardRow}>
                  <Text style={styles.ratingsCardLabel}>Dishes</Text>
                  <View style={styles.dishMentionRow}>
                    {topDishes.map(dish => dish.dishId ? (
                      <Chip
                        key={dish.name}
                        label={dish.name}
                        style={styles.dishMentionChip}
                        onPress={() => router.push(routes.dishDetail(dish.dishId ?? ''))}
                      />
                    ) : (
                      <Text key={dish.name} style={styles.dishMentions}>{dish.name}</Text>
                    ))}
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        <View style={styles.divider} />
        <View style={styles.contactSection}>
          {!!address && (
            <TouchableOpacity
              style={styles.contactRow}
              onPress={openAddress}
              accessibilityRole="button"
              accessibilityLabel="Open restaurant address"
            >
              <PinIcon />
              <Text style={styles.contactText} numberOfLines={2}>{address}</Text>
            </TouchableOpacity>
          )}
          {!!phoneNumber && (
            <TouchableOpacity style={styles.contactRow} onPress={() => openPhone(phoneNumber)}>
              <PhoneIcon />
              <Text style={styles.contactText}>{phoneNumber}</Text>
            </TouchableOpacity>
          )}
          {!!website && (
            <TouchableOpacity style={styles.contactRow} onPress={() => openWebsite(website)}>
              <GlobeIcon />
              <Text style={styles.contactTextLink} numberOfLines={1}>
                {website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </Text>
            </TouchableOpacity>
          )}
          {weekdayText.length > 0 && (
            <TouchableOpacity style={styles.contactRow} onPress={() => setHoursExpanded(e => !e)} activeOpacity={0.7}>
              <ClockIcon />
              <View style={{ flex: 1 }}>
                {hoursExpanded ? (
                  weekdayText.map((line, i) => (
                    <Text key={i} style={[styles.contactText, i === todayIdx && styles.contactTextBold]}>{line}</Text>
                  ))
                ) : (
                  <Text style={styles.contactText}>{todayText}</Text>
                )}
              </View>
              <ChevronDown expanded={hoursExpanded} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {popularDishes.length > 0 && (
        <>
          <View style={styles.divider} />
          <View style={styles.dishesSection}>
            <Text style={styles.dishesSectionTitle}>Popular dishes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dishesRow}>
              {popularDishes.map(d => (
                <View key={d.name} style={styles.dishChip}>
                  <Text style={styles.dishChipName}>{d.name}</Text>
                  {d.count > 1 && <Text style={styles.dishChipCount}>{d.count}</Text>}
                </View>
              ))}
            </ScrollView>
          </View>
        </>
      )}

      <View style={styles.divider} />
      <View style={styles.postsSection}>
        <View style={styles.postsSectionHeader}>
          <Text style={styles.postsSectionTitle}>
            {contextPosts.length > 0
              ? `${contextPosts.length} post${contextPosts.length !== 1 ? 's' : ''} on Rekkus`
              : 'Posts on Rekkus'}
          </Text>
          {contextPosts.length > 1 && (
            <TouchableOpacity
              style={styles.sortBtn}
              onPress={openSortSheet}
              accessibilityRole="button"
              accessibilityLabel="Sort restaurant posts"
            >
              <SortIcon />
              <Text style={styles.sortBtnText}>{SORT_LABELS[sortPosts]}</Text>
            </TouchableOpacity>
          )}
        </View>

        {sortedPosts.length === 0 ? (
          <Text style={styles.emptyPostsText}>No posts yet for this location</Text>
        ) : (
          sortedPosts.map(post => (
            <TouchableOpacity key={post.id} style={styles.postRow} onPress={() => router.push(routes.postDetail(String(post.dbId || post.id)))} activeOpacity={0.8}>
              <View style={[styles.postThumb, { backgroundColor: imgColors[post.imgKey] }]}>
                {post.imageUrl ? (
                  <CachedImage source={{ uri: post.imageUrl }} style={styles.absoluteFill} />
                ) : (
                  <ImagePlaceholder size={20} />
                )}
              </View>
              <View style={styles.postRowContent}>
                <View style={styles.postRowTop}>
                  <Text style={styles.postRowCreator}>@{post.creator}</Text>
                  <Text style={styles.postRowLikes}>♡ {post.likes}</Text>
                </View>
                <Text style={styles.postRowTitle} numberOfLines={2}>{post.title}</Text>
                <PostRatingStrip food={post.food} vibe={post.vibe} cost={post.cost} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={{ height: spacing.px40 }} />
    </ScrollView>
  )
}
