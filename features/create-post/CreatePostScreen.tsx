import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, BackHandler } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft } from '@/components/icons'
import StepDetails from '@/components/post-create/StepDetails'
import StepMedia from '@/components/post-create/StepMedia'
import StepReview from '@/components/post-create/StepReview'
import { EmptyState } from '@/components/ui/EmptyState'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import { useConnectivity } from '@/lib/contexts/ConnectivityContext'
import { usePosts } from '@/lib/contexts/PostsContext'
import { usePostUploadQueue } from '@/lib/contexts/PostUploadContext'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { haptic } from '@/lib/haptics'
import { tasteToLegacyFood, valueToLegacyCost } from '@/lib/dataSources/rekkusPicks'
import { routes } from '@/lib/routes'
import { findOrCreateDish } from '@/lib/services/dishes'
import type { CreatePostDraft, CreatePostDraftStatus } from '@/lib/services/postDrafts'
import {
  clearCreatePostDraft,
  listCreatePostDraftSummaries,
  loadCreatePostDraft,
  markCreatePostDraftPublished,
  saveCreatePostDraftAsNew,
  saveCreatePostDraftRemote,
  saveCreatePostDraft,
} from '@/lib/services/postDrafts'
import { enqueueServerMediaProcessing } from '@/lib/services/postMediaProcessing'
import { createPost, loadPostForEditing, recordPostEditEvent, updatePost } from '@/lib/services/posts'
import type { SelectedPlace } from '@/lib/services/restaurants'
import type { DishTag, PostMedia, RekkusOccasionTag, RekkusTasteVerdict, RekkusValueVerdict } from '@/types/domain'
import { makeStyles } from './CreatePostScreen.styles'
import { CreatePostSheets, type DraftNotice, type SaveDraftMode } from './CreatePostSheets'

type Step = 1 | 2 | 3
type EntryMode = 'loading' | 'choosing' | 'editing'

export default function PostScreen() {
  const router = useRouter()
  const { draftId, intent, nonce, postId } = useLocalSearchParams<{
    draftId?: string
    intent?: string
    postId?: string
    nonce?: string
  }>()
  const { refresh } = usePosts()
  const uploadQueue = usePostUploadQueue()
  const { user } = useAuth()
  const { requireOnline } = useConnectivity()
  const { requireAuth } = useAuthGate()
  const c = useThemeColors()
  const styles = useMemo(() => makeStyles(c), [c])

  const [step, setStep] = useState<Step>(1)
  const [posting, setPosting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [currentDraftId, setCurrentDraftId] = useState<string | undefined>(draftId)
  const [currentDraftStatus, setCurrentDraftStatus] = useState<CreatePostDraftStatus | undefined>(undefined)
  const [entryMode, setEntryMode] = useState<EntryMode>(draftId ? 'editing' : 'loading')
  const [saveSheetVisible, setSaveSheetVisible] = useState(false)
  const [draftNotice, setDraftNotice] = useState<DraftNotice | null>(null)
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false)
  const [editConflictVisible, setEditConflictVisible] = useState(false)
  const [editBaselineCount, setEditBaselineCount] = useState<number | null>(null)
  const [retryPostAvailable, setRetryPostAvailable] = useState(false)
  const ignoreNextChooserDismiss = useRef(false)
  const isEditingPost = intent === 'edit' && !!postId
  // Step 1 state
  const [media, setMedia] = useState<PostMedia[]>([])
  const [title, setTitle] = useState('')
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null)
  const [dishTags, setDishTags] = useState<DishTag[]>([])

  // Step 2 state
  const [foodRating, setFoodRating] = useState(0)
  const [vibeRating, setVibeRating] = useState(0)
  const [costRating, setCostRating] = useState(0)
  const [tasteVerdict, setTasteVerdict] = useState<RekkusTasteVerdict | undefined>(undefined)
  const [valueVerdict, setValueVerdict] = useState<RekkusValueVerdict | undefined>(undefined)
  const [occasionTags, setOccasionTags] = useState<RekkusOccasionTag[]>([])
  const [body, setBody] = useState('')
  const [bestDish, setBestDish] = useState('')
  const [cuisineType, setCuisineType] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [hashtagInput, setHashtagInput] = useState('')

  const hasDraftContent =
    media.length > 0 ||
    title.trim().length > 0 ||
    selectedPlace !== null ||
    dishTags.length > 0 ||
    foodRating > 0 ||
    vibeRating > 0 ||
    costRating > 0 ||
    !!tasteVerdict ||
    !!valueVerdict ||
    occasionTags.length > 0 ||
    body.trim().length > 0 ||
    bestDish.trim().length > 0 ||
    cuisineType.trim().length > 0 ||
    hashtags.length > 0 ||
    hashtagInput.trim().length > 0
  const canAdvance = title.trim().length >= 3 && media.length > 0

  useEffect(() => {
    if (!user) requireAuth()
  }, [user, requireAuth])

  const refreshDraftSummaries = useCallback(async () => {
    if (!user?.id) return []
    const items = await listCreatePostDraftSummaries()
    return items
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    if (isEditingPost) {
      setEntryMode('editing')
      return
    }
    if (draftId) {
      setEntryMode('editing')
      return
    }
    if (intent === 'new' || intent === 'choose') {
      clearForm()
      setEntryMode('editing')
    }
    if (intent === 'new') return
    if (intent === 'choose') {
      void refreshDraftSummaries().then(items => {
        setEntryMode(items.length > 0 ? 'choosing' : 'editing')
      })
      return
    }
    void refreshDraftSummaries().then(items => {
      setEntryMode(items.length > 0 ? 'choosing' : 'editing')
    })
  }, [draftId, intent, nonce, user?.id, isEditingPost, refreshDraftSummaries])

  function applyDraftToForm(draft: CreatePostDraft) {
    setCurrentDraftId(draft.remoteId ?? draft.id)
    setCurrentDraftStatus(draft.status)
    setMedia(draft.media ?? [])
    setTitle(draft.title ?? '')
    setSelectedPlace(draft.selectedPlace ?? null)
    setDishTags(draft.dishTags ?? [])
    setFoodRating(draft.foodRating ?? 0)
    setVibeRating(draft.vibeRating ?? 0)
    setCostRating(draft.costRating ?? 0)
    setTasteVerdict(draft.tasteVerdict)
    setValueVerdict(draft.valueVerdict)
    setOccasionTags(draft.occasionTags ?? [])
    setBody(draft.body ?? '')
    setBestDish(draft.bestDish ?? '')
    setCuisineType(draft.cuisineType ?? '')
    setHashtags(draft.hashtags ?? [])
    setHashtagInput(draft.hashtagInput ?? '')
    setEntryMode('editing')
  }

  useEffect(() => {
    if (!draftId) return
    let mounted = true
    void loadCreatePostDraft(draftId).then(draft => {
      if (!mounted || !draft) return
      applyDraftToForm(draft)
    })
    return () => {
      mounted = false
    }
  }, [draftId])

  useEffect(() => {
    if (!isEditingPost || !postId || !user?.id) return
    let mounted = true
    void loadPostForEditing(postId).then(post => {
      if (!mounted || !post) return
      setMedia(post.media ?? [])
      setTitle(post.title ?? '')
      setSelectedPlace(post.restaurantId ? {
        placeId: post.placeId ?? post.restaurantId,
        restaurantId: post.restaurantId,
        name: post.location,
        address: post.address ?? '',
        lat: post.lat ?? 0,
        lng: post.lng ?? 0,
      } : null)
      setDishTags(post.dishTags ?? [])
      setFoodRating(post.food ?? 0)
      setVibeRating(post.vibe ?? 0)
      setCostRating(post.cost ?? 0)
      setTasteVerdict(post.tasteVerdict)
      setValueVerdict(post.valueVerdict)
      setOccasionTags(post.occasionTags ?? [])
      setBody(post.body ?? '')
      setBestDish(post.best_dish ?? '')
      setCuisineType(post.cuisine_type ?? '')
      setHashtags(post.tags ?? [])
      setHashtagInput('')
      setCurrentDraftId(undefined)
      setCurrentDraftStatus(undefined)
      setEditBaselineCount(post.editCount ?? 0)
      recordPostEditEvent(postId, user.id, 'edit_started').catch(() => {})
      analytics.postEdit(user.id, postId, 'started')
    })
    return () => {
      mounted = false
    }
  }, [isEditingPost, postId, user?.id])

  const buildDraft = useCallback((): CreatePostDraft => {
    return {
      media,
      id: currentDraftId,
      remoteId: currentDraftId,
      userId: user?.id,
      status: currentDraftStatus,
      title,
      selectedPlace,
      dishTags,
      foodRating,
      vibeRating,
      costRating,
      tasteVerdict,
      valueVerdict,
      occasionTags,
      body,
      bestDish,
      cuisineType,
      hashtags,
      hashtagInput,
      updatedAt: new Date().toISOString(),
    }
  }, [media, currentDraftId, user?.id, currentDraftStatus, title, selectedPlace, dishTags, foodRating, vibeRating, costRating, tasteVerdict, valueVerdict, occasionTags, body, bestDish, cuisineType, hashtags, hashtagInput])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasDraftContent) return
      if (entryMode !== 'editing') return
      if (isEditingPost) return
      if (currentDraftStatus === 'saved') return
      void saveCreatePostDraft(buildDraft()).then(saved => {
        setCurrentDraftId(saved.remoteId ?? saved.id)
        setCurrentDraftStatus(saved.status)
        void refreshDraftSummaries()
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [
    hasDraftContent,
    entryMode,
    currentDraftStatus,
    isEditingPost,
    buildDraft,
    refreshDraftSummaries,
  ])

  // Ref keeps BackHandler current: handleBack is defined after the early return below.
  const handleBackRef = useRef<() => void>(() => {})

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBackRef.current()
        return true
      })
      return () => sub.remove()
    }, [])
  )

  if (!user) return null

  function handleBack() {
    if (entryMode === 'choosing') {
      router.replace('/(tabs)/feed')
      return
    }
    if (step === 1) {
      if (!hasDraftContent) {
        router.replace('/(tabs)/feed')
        return
      }
      setLeaveConfirmVisible(true)
    }
    else setStep((step - 1) as Step)
  }
  handleBackRef.current = handleBack

  function handleNext() {
    if (step < 3) setStep((step + 1) as Step)
  }

  function clearForm() {
    setStep(1)
    setMedia([])
    setTitle('')
    setSelectedPlace(null)
    setDishTags([])
    setFoodRating(0)
    setVibeRating(0)
    setCostRating(0)
    setTasteVerdict(undefined)
    setValueVerdict(undefined)
    setOccasionTags([])
    setBody('')
    setBestDish('')
    setCuisineType('')
    setHashtags([])
    setHashtagInput('')
    setCurrentDraftId(undefined)
    setCurrentDraftStatus(undefined)
  }

  function startNewPost() {
    clearForm()
    setEntryMode('editing')
  }

  function openSaveDraftOptions() {
    if (!hasDraftContent) {
      setDraftNotice({
        title: 'Nothing to save yet',
        subtitle: 'Add media, a title, or review details before saving a draft.',
      })
      return
    }
    if (currentDraftStatus === 'saved' && currentDraftId) {
      setSaveSheetVisible(true)
      return
    }
    void saveDraftWithMode('update')
  }

  async function saveDraftWithMode(mode: SaveDraftMode, options: { showConfirmation?: boolean } = {}) {
    if (!user) return
    const showConfirmation = options.showConfirmation ?? true
    setSavingDraft(true)
    const draft = { ...buildDraft(), status: 'saved' as const }
    const saved = mode === 'new'
      ? await saveCreatePostDraftAsNew(draft, user.id)
      : await saveCreatePostDraftRemote(draft, { visible: true, userId: user.id })
    setSavingDraft(false)
    setCurrentDraftId(saved.remoteId ?? saved.id)
    setCurrentDraftStatus(saved.status)
    await refreshDraftSummaries()
    if (saved.syncStatus === 'failed') {
      setDraftNotice({
        title: 'Saved on this device',
        subtitle: 'We could not sync draft media yet. Your draft is recoverable here and can retry later.',
      })
      return
    }
    if (showConfirmation) {
      setDraftNotice({
        title: mode === 'new' ? 'Saved as new draft' : 'Draft saved',
        subtitle: 'You can find it in Drafts from the create screen.',
      })
    }
  }

  async function handlePost() {
    if (!requireOnline()) {
      setRetryPostAvailable(true)
      setDraftNotice({
        title: 'You are offline',
        subtitle: 'Your review stays here. Reconnect, then tap Try again to publish.',
      })
      return
    }
    if (isEditingPost && postId && user?.id) {
      setPosting(true)
      try {
        await updatePost(postId, {
          userId: user.id,
          caption: title.trim(),
          restaurantId: selectedPlace?.restaurantId ?? null,
          foodRating: tasteToLegacyFood(tasteVerdict) || foodRating || null,
          vibeRating: vibeRating || null,
          costRating: valueToLegacyCost(valueVerdict) || costRating || null,
          tasteVerdict: tasteVerdict ?? null,
          valueVerdict: valueVerdict ?? null,
          occasionTags,
          cuisineType: cuisineType || null,
          bestDish: bestDish.trim() || null,
          dishTags,
          media,
          expectedEditCount: editBaselineCount,
        })
        analytics.postEdit(user.id, postId, 'saved')
        setPosting(false)

        router.replace(routes.postDetail(postId))
      } catch (error) {
        setPosting(false)
        const message = error instanceof Error ? error.message : ''
        if (message === 'post_edit_conflict' || message === 'post_unavailable') {
          recordPostEditEvent(postId, user.id, 'edit_conflict').catch(() => {})
          analytics.postEdit(user.id, postId, 'conflict')
          setEditConflictVisible(true)
          return
        }
        console.error('[handlePost edit]', error)
        setDraftNotice({
          title: 'Could not save changes',
          subtitle: 'Your edits are still here. Check your connection and try again.',
        })
      }
      return
    }
    if (!user) return
    setPosting(true)
    const jobId = `post-${Date.now()}`
    uploadQueue.startJob({
      id: jobId,
      title: title.trim() || 'New post',
      coverUri: media[0]?.thumbnailUrl ?? media[0]?.uri,
      media,
    })
    try {
      uploadQueue.updateJob(jobId, { status: 'uploading', progress: 0.45 })
      await enqueueServerMediaProcessing(media)
      uploadQueue.updateJob(jobId, { status: 'publishing', progress: 0.84 })
      let dishId: string | null = null
      if (bestDish.trim() && selectedPlace?.restaurantId) {
        try {
          dishId = await findOrCreateDish({
            name: bestDish.trim(),
            restaurantId: selectedPlace.restaurantId,
            cuisineType: cuisineType || null,
            userId: user.id,
            context: { source: 'post_creation' },
          })
        } catch {
          // Intentional non-blocking fallback: post publishes without dish_id.
          // Dish graph link can be repaired later (B-289). // B-282
        }
      }
      await createPost({
        userId: user.id,
        caption: title.trim() || null,
        restaurantId: selectedPlace?.restaurantId ?? null,
        foodRating: tasteToLegacyFood(tasteVerdict) || foodRating || null,
        vibeRating: vibeRating || null,
        costRating: valueToLegacyCost(valueVerdict) || costRating || null,
        tasteVerdict: tasteVerdict ?? null,
        valueVerdict: valueVerdict ?? null,
        occasionTags,
        cuisineType: cuisineType || null,
        bestDish: bestDish.trim() || null,
        dishId,
        dishTags,
        media,
      })
      clearForm()
      await markCreatePostDraftPublished(currentDraftId)
      uploadQueue.completeJob(jobId)
      void haptic.confirmPublish()
      await refresh()
      setPosting(false)
      router.replace('/(tabs)/feed')
    } catch (err) {
      console.error('[handlePost]', err)
      uploadQueue.failJob(jobId, 'post_failed')
      setPosting(false)
      setRetryPostAvailable(true)
      setDraftNotice({
        title: 'Could not publish post',
        subtitle: 'Tap "Try again" or check your connection and tap Post.',
      })
    }
  }

  function handleRetryPost() {
    uploadQueue.jobs.filter(j => j.status === 'failed').forEach(j => uploadQueue.clearJob(j.id))
    setRetryPostAvailable(false)
    setDraftNotice(null)
    void handlePost()
  }

  const STEP_TITLES: Record<Step, string> = {
    1: 'Media',
    2: 'Review',
    3: 'Share',
  }

  if (entryMode === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.choiceHeader}>
          <Text style={styles.choiceTitle}>Create</Text>
        </View>
        <EmptyState
          loading
          title="Opening create"
          subtitle="Checking for saved drafts."
        />
      </SafeAreaView>
    )
  }

  if (entryMode === 'choosing') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.choiceHeader}>
          <Text style={styles.choiceTitle}>Create</Text>
        </View>
        <RekkusActionSheet
          visible
          title="Create a post"
          subtitle="Start fresh, or open your saved drafts list."
          options={[
            { label: 'New post', value: 'new', description: 'Start with a blank review.', variant: 'tile' },
            { label: 'Edit a draft', value: 'all', description: 'Choose from your saved draft posts.', variant: 'tile' },
          ]}
          onSelect={value => {
            ignoreNextChooserDismiss.current = true
            if (value === 'new') {
              startNewPost()
              return
            }
            if (value === 'all') {
              router.push(routes.createDrafts())
              return
            }
          }}
          onDismiss={() => {
            if (ignoreNextChooserDismiss.current) {
              ignoreNextChooserDismiss.current = false
              return
            }
            router.replace('/(tabs)/feed')
          }}
        />
      </SafeAreaView>
    )
  }

  const sheetProps = {
    colors: c, saveSheetVisible, setSaveSheetVisible, draftNotice, setDraftNotice,
    leaveConfirmVisible, setLeaveConfirmVisible, editConflictVisible, setEditConflictVisible,
    isEditingPost, onSaveDraft: saveDraftWithMode, onDraftDone: () => router.replace('/(tabs)/feed'),
    ...(retryPostAvailable ? { onRetryPost: handleRetryPost } : {}),
    onDiscard: async () => {
      if (isEditingPost && postId && user?.id) recordPostEditEvent(postId, user.id, 'edit_discarded').catch(() => {})
      if (currentDraftId) await clearCreatePostDraft(currentDraftId)
      clearForm()
      router.replace('/(tabs)/feed')
    },
    onReviewLatest: () => { if (postId) router.replace(routes.postDetail(postId)) },
    onSaveConflictDraft: () => saveDraftWithMode('new', { showConfirmation: true }),
    onDiscardConflict: async () => {
      if (postId && user?.id) recordPostEditEvent(postId, user.id, 'edit_discarded').catch(() => {})
      clearForm()
      if (postId) router.replace(routes.postDetail(postId))
    },
  }
  const mediaProps = { media, setMedia, title, setTitle, selectedPlace, setSelectedPlace, cuisineType, dishTags, setDishTags }
  const detailsProps = { foodRating, setFoodRating, vibeRating, setVibeRating, costRating, setCostRating, tasteVerdict, setTasteVerdict, valueVerdict, setValueVerdict, occasionTags, setOccasionTags, body, setBody, bestDish, setBestDish, cuisineType, setCuisineType, hashtags, setHashtags, hashtagInput, setHashtagInput }
  const reviewProps = { title, body, media, selectedPlace, foodRating, vibeRating, costRating, tasteVerdict, valueVerdict, occasionTags, cuisineType, bestDish, hashtags, onEditBasics: () => setStep(1), onEditDetails: () => setStep(2), onPost: handlePost, primaryLabel: isEditingPost ? 'Save changes' : 'Post review', posting, onSaveDraft: openSaveDraftOptions, savingDraft }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={step === 1 ? 'Cancel post creation' : 'Go back'}
        >
          <ChevronLeft size={16} />
          <Text style={styles.backText}>{step === 1 ? 'Cancel' : 'Back'}</Text>
        </TouchableOpacity>

        <View style={styles.centerWrap}>
          <Text style={styles.stepTitle}>{STEP_TITLES[step]}</Text>
          <View style={styles.dots}>
            {([1, 2, 3] as Step[]).map(s => (
              <View key={s} style={[styles.dot, s === step && styles.dotActive]} />
            ))}
          </View>
        </View>

        <View style={styles.rightActions}>
          {hasDraftContent && step < 3 && (
            <TouchableOpacity
              onPress={openSaveDraftOptions}
              hitSlop={8}
              style={styles.headerAction}
              disabled={savingDraft || posting}
              accessibilityRole="button"
            >
              <Text style={[styles.saveText, (savingDraft || posting) && styles.saveTextDisabled]}>
                {savingDraft ? 'Saving' : 'Save'}
              </Text>
            </TouchableOpacity>
          )}
          {step < 3 ? (
            <TouchableOpacity
              style={[styles.nextBtn, !canAdvance && styles.nextBtnDisabled]}
              onPress={canAdvance ? handleNext : undefined}
              disabled={!canAdvance}
              accessibilityRole="button"
            >
              <Text style={[styles.nextBtnText, !canAdvance && styles.nextBtnTextDisabled]}>
                Next
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerAction} />
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {step === 1 && (
          <StepMedia {...mediaProps} />
        )}
        {step === 2 && (
          <StepDetails {...detailsProps} />
        )}
        {step === 3 && (
          <StepReview {...reviewProps} />
        )}
      </KeyboardAvoidingView>
      <CreatePostSheets {...sheetProps} />
    </SafeAreaView>
  )
}
