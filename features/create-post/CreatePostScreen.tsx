import { usePreventRemove, type NavigationAction } from '@react-navigation/native'
import { useRouter, useLocalSearchParams, useFocusEffect, useNavigation } from 'expo-router'
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, BackHandler, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowRight, ChevronLeft, SaveDraftIcon } from '@/components/icons'
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
import { tasteToLegacyFood, valueToLegacyCost } from '@/lib/dataSources/rekkusPicks'
import { haptic } from '@/lib/haptics'
import { routes } from '@/lib/routes'
import { findOrCreateDish } from '@/lib/services/dishes'
import {
  clearCreatePostDraft,
  markCreatePostDraftPublished,
  saveCreatePostDraftAsNew,
  saveCreatePostDraftRemote,
} from '@/lib/services/postDrafts'
import { enqueueServerMediaProcessing } from '@/lib/services/postMediaProcessing'
import { createPost, loadPostForEditing, recordPostEditEvent, updatePost } from '@/lib/services/posts'
import { makeStyles } from './CreatePostScreen.styles'
import { CreatePostSheets, type DraftNotice, type SaveDraftMode } from './CreatePostSheets'
import { useCreatePostDraftLoader } from './useCreatePostDraftLoader'
import { useCreatePostFormState } from './useCreatePostFormState'

type Step = 1 | 2 | 3

const STEP_TITLES: Record<Step, string> = { 1: 'Media', 2: 'Review', 3: 'Share' }

export default function PostScreen() {
  const router = useRouter()
  const navigation = useNavigation()
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
  const [saveSheetVisible, setSaveSheetVisible] = useState(false)
  const [draftNotice, setDraftNotice] = useState<DraftNotice | null>(null)
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false)
  const [allowNativeRemove, setAllowNativeRemove] = useState(false)
  const [editConflictVisible, setEditConflictVisible] = useState(false)
  const [editBaselineCount, setEditBaselineCount] = useState<number | null>(null)
  const [retryPostAvailable, setRetryPostAvailable] = useState(false)
  const [showNextHint, setShowNextHint] = useState(false)
  const nextHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ignoreNextChooserDismiss = useRef(false)
  const pendingRemoveAction = useRef<NavigationAction | null>(null)
  const sessionStartedAt = useRef<number>(Date.now())
  const stepEnteredAt = useRef<number>(Date.now())
  const rageTapNextTimestamps = useRef<number[]>([])
  const isEditingPost = intent === 'edit' && !!postId

  const form = useCreatePostFormState(user?.id, draftId)
  const { entryMode, setEntryMode, refreshDraftSummaries } = useCreatePostDraftLoader({
    draftId,
    intent,
    nonce,
    userId: user?.id,
    isEditingPost,
    hasDraftContent: form.hasDraftContent,
    currentDraftStatus: form.currentDraftStatus,
    buildDraft: form.buildDraft,
    setCurrentDraftId: form.setCurrentDraftId,
    setCurrentDraftStatus: form.setCurrentDraftStatus,
    applyDraftToForm: form.applyDraftToForm,
    clearFormFields: form.clearFormFields,
  })

  const shouldProtectNativeDismiss = entryMode === 'editing' && form.hasDraftContent && !allowNativeRemove

  usePreventRemove(shouldProtectNativeDismiss, ({ data }) => {
    pendingRemoveAction.current = data.action
    analytics.createPostFunnel(user?.id ?? null, step, 'abandoned', {
      duration_ms: Date.now() - stepEnteredAt.current,
      reason: 'native_dismiss',
    })
    setLeaveConfirmVisible(true)
  })

  useEffect(() => {
    if (!user) requireAuth()
  }, [user, requireAuth])

  const { applyPostToForm } = form
  useEffect(() => {
    if (!isEditingPost || !postId || !user?.id) return
    let mounted = true
    void loadPostForEditing(postId).then(post => {
      if (!mounted || !post) return
      applyPostToForm(post)
      setEditBaselineCount(post.editCount ?? 0)
      recordPostEditEvent(postId, user.id, 'edit_started').catch(() => {})
      analytics.postEdit(user.id, postId, 'started')
    })
    return () => { mounted = false }
  }, [isEditingPost, postId, user?.id, applyPostToForm])

  useEffect(() => {
    stepEnteredAt.current = Date.now()
    analytics.createPostFunnel(user?.id ?? null, step, 'viewed')
    setShowNextHint(false)
    if (nextHintTimer.current) clearTimeout(nextHintTimer.current)
  }, [step, user?.id])

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
    if (!user) return
    if (entryMode === 'choosing') {
      router.replace('/(tabs)/feed')
      return
    }
    if (step === 1) {
      if (!form.hasDraftContent) {
        router.replace('/(tabs)/feed')
        return
      }
      analytics.createPostFunnel(user?.id ?? null, step, 'abandoned', {
        duration_ms: Date.now() - stepEnteredAt.current,
        reason: 'back_from_step_1',
      })
      setLeaveConfirmVisible(true)
    }
    else setStep((step - 1) as Step)
  }
  handleBackRef.current = handleBack

  function clearPendingRemoveAction() {
    pendingRemoveAction.current = null
  }

  function finishCreateExit() {
    const pendingAction = pendingRemoveAction.current
    pendingRemoveAction.current = null
    setAllowNativeRemove(true)
    if (pendingAction) {
      setTimeout(() => navigation.dispatch(pendingAction), 0)
      return
    }
    router.replace('/(tabs)/feed')
  }

  function handleNext() {
    if (!user) return
    if (step < 3) {
      const now = Date.now()
      const recent = rageTapNextTimestamps.current.filter(t => now - t < 1000)
      recent.push(now)
      rageTapNextTimestamps.current = recent
      if (recent.length >= 3) {
        analytics.rageTap(user.id, 'create_post', 'next', step, recent.length)
        rageTapNextTimestamps.current = []
      }
      analytics.createPostFunnel(user.id, step, 'completed', {
        duration_ms: now - stepEnteredAt.current,
      })
      if (step === 1 && form.selectedPlace === null) {
        analytics.restaurantFieldSkipped(user.id)
      }
      setStep((step + 1) as Step)
    }
  }

  function clearForm() {
    setStep(1)
    form.clearFormFields()
  }

  function startNewPost() {
    clearForm()
    setEntryMode('editing')
  }

  function openSaveDraftOptions() {
    if (!form.hasDraftContent) {
      setDraftNotice({
        title: 'Nothing to save yet',
        subtitle: 'Add media, a title, or review details before saving a draft.',
      })
      return
    }
    if (form.currentDraftStatus === 'saved' && form.currentDraftId) {
      setSaveSheetVisible(true)
      return
    }
    void saveDraftWithMode('update')
  }

  async function saveDraftWithMode(mode: SaveDraftMode, options: { showConfirmation?: boolean } = {}) {
    if (!user) return
    const showConfirmation = options.showConfirmation ?? true
    setSavingDraft(true)
    const draft = { ...form.buildDraft(), status: 'saved' as const }
    const saved = mode === 'new'
      ? await saveCreatePostDraftAsNew(draft, user.id)
      : await saveCreatePostDraftRemote(draft, { visible: true, userId: user.id })
    setSavingDraft(false)
    form.setCurrentDraftId(saved.remoteId ?? saved.id)
    form.setCurrentDraftStatus(saved.status)
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
          caption: form.title.trim(),
          restaurantId: form.selectedPlace?.restaurantId ?? null,
          foodRating: tasteToLegacyFood(form.tasteVerdict) || form.foodRating || null,
          vibeRating: form.vibeRating || null,
          costRating: valueToLegacyCost(form.valueVerdict) || form.costRating || null,
          tasteVerdict: form.tasteVerdict ?? null,
          valueVerdict: form.valueVerdict ?? null,
          occasionTags: form.occasionTags,
          cuisineType: form.cuisineType || null,
          mustOrder: form.mustOrder.trim() || null,
          dishTags: form.dishTags,
          media: form.media,
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
      title: form.title.trim() || 'New post',
      coverUri: form.media[0]?.thumbnailUrl ?? form.media[0]?.uri,
      media: form.media,
    })
    try {
      uploadQueue.updateJob(jobId, { status: 'uploading', progress: 0.45 })
      await enqueueServerMediaProcessing(form.media)
      uploadQueue.updateJob(jobId, { status: 'publishing', progress: 0.84 })
      let dishId: string | null = null
      if (form.mustOrder.trim() && form.selectedPlace?.restaurantId) {
        try {
          dishId = await findOrCreateDish({
            name: form.mustOrder.trim(),
            restaurantId: form.selectedPlace.restaurantId,
            cuisineType: form.cuisineType || null,
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
        caption: form.title.trim() || null,
        restaurantId: form.selectedPlace?.restaurantId ?? null,
        foodRating: tasteToLegacyFood(form.tasteVerdict) || form.foodRating || null,
        vibeRating: form.vibeRating || null,
        costRating: valueToLegacyCost(form.valueVerdict) || form.costRating || null,
        tasteVerdict: form.tasteVerdict ?? null,
        valueVerdict: form.valueVerdict ?? null,
        occasionTags: form.occasionTags,
        cuisineType: form.cuisineType || null,
        mustOrder: form.mustOrder.trim() || null,
        dishId,
        dishTags: form.dishTags,
        media: form.media,
      })
      analytics.createPostFunnel(user.id, 3, 'completed', {
        duration_ms: Date.now() - stepEnteredAt.current,
        session_duration_ms: Date.now() - sessionStartedAt.current,
      })
      clearForm()
      await markCreatePostDraftPublished(form.currentDraftId)
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
            if (value === 'new') { startNewPost(); return }
            if (value === 'all') { router.push(routes.createDrafts()); return }
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
    isEditingPost, onSaveDraft: saveDraftWithMode, onDraftDone: finishCreateExit,
    onCancelLeave: clearPendingRemoveAction,
    ...(retryPostAvailable ? { onRetryPost: handleRetryPost } : {}),
    onDiscard: async () => {
      analytics.createPostFunnel(user.id, step, 'abandoned', {
        duration_ms: Date.now() - stepEnteredAt.current,
        reason: 'discard',
      })
      if (isEditingPost && postId && user?.id) recordPostEditEvent(postId, user.id, 'edit_discarded').catch(() => {})
      if (form.currentDraftId) await clearCreatePostDraft(form.currentDraftId)
      clearForm()
      finishCreateExit()
    },
    onReviewLatest: () => { if (postId) router.replace(routes.postDetail(postId)) },
    onSaveConflictDraft: () => saveDraftWithMode('new', { showConfirmation: true }),
    onDiscardConflict: async () => {
      if (postId && user?.id) recordPostEditEvent(postId, user.id, 'edit_discarded').catch(() => {})
      clearForm()
      if (postId) router.replace(routes.postDetail(postId))
    },
  }
  const mediaProps = { userId: user.id, media: form.media, setMedia: form.setMedia, title: form.title, setTitle: form.setTitle, selectedPlace: form.selectedPlace, setSelectedPlace: form.setSelectedPlace, cuisineType: form.cuisineType, dishTags: form.dishTags, setDishTags: form.setDishTags }
  const detailsProps = { foodRating: form.foodRating, setFoodRating: form.setFoodRating, vibeRating: form.vibeRating, setVibeRating: form.setVibeRating, costRating: form.costRating, setCostRating: form.setCostRating, tasteVerdict: form.tasteVerdict, setTasteVerdict: form.setTasteVerdict, valueVerdict: form.valueVerdict, setValueVerdict: form.setValueVerdict, occasionTags: form.occasionTags, setOccasionTags: form.setOccasionTags, body: form.body, setBody: form.setBody, cuisineType: form.cuisineType, setCuisineType: form.setCuisineType, hashtags: form.hashtags, setHashtags: form.setHashtags, hashtagInput: form.hashtagInput, setHashtagInput: form.setHashtagInput, mustOrder: form.mustOrder, setMustOrder: form.setMustOrder, dishTags: form.dishTags }
  const reviewProps = { title: form.title, body: form.body, media: form.media, dishTags: form.dishTags, selectedPlace: form.selectedPlace, foodRating: form.foodRating, vibeRating: form.vibeRating, costRating: form.costRating, tasteVerdict: form.tasteVerdict, valueVerdict: form.valueVerdict, occasionTags: form.occasionTags, cuisineType: form.cuisineType, mustOrder: form.mustOrder, hashtags: form.hashtags, onEditBasics: () => setStep(1), onEditDetails: () => setStep(2), onPost: handlePost, primaryLabel: isEditingPost ? 'Save changes' : 'Post review', posting, onSaveDraft: openSaveDraftOptions, savingDraft }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
          <View
            style={styles.stepDots}
            accessibilityRole="text"
            accessibilityLabel={`Step ${step} of 3`}
          >
            {([1, 2, 3] as const).map(item => (
              <View
                key={item}
                style={[styles.stepDot, item <= step && styles.stepDotActive]}
                accessible={false}
              />
            ))}
          </View>
        </View>

        <View style={styles.rightActions}>
          {form.hasDraftContent && (
            <TouchableOpacity
              onPress={openSaveDraftOptions}
              hitSlop={8}
              style={styles.headerAction}
              disabled={savingDraft || posting}
              accessibilityRole="button"
              accessibilityLabel={savingDraft ? 'Saving draft' : 'Save draft'}
            >
              <SaveDraftIcon size={20} color={(savingDraft || posting) ? c.text3 : c.accent} />
            </TouchableOpacity>
          )}
          {step < 3 ? (
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                style={[styles.nextBtn, !form.canAdvance && styles.nextBtnDisabled]}
                onPress={form.canAdvance ? handleNext : undefined}
                disabled={!form.canAdvance}
                accessibilityRole="button"
                accessibilityLabel="Next"
                accessibilityHint={
                  !form.canAdvance
                    ? form.media.length === 0 && form.title.trim().length < 3
                      ? 'Add a photo and a title of at least 3 characters to continue'
                      : form.media.length === 0
                      ? 'Add a photo to continue'
                      : 'Your title needs at least 3 characters'
                    : undefined
                }
              >
                <ArrowRight size={22} color={form.canAdvance ? c.accent : c.text3} />
              </TouchableOpacity>
              {!form.canAdvance && (
                <Pressable
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  onPress={() => {
                    analytics.deadClick(user.id, 'create_post', 'next', step)
                    setShowNextHint(true)
                    if (nextHintTimer.current) clearTimeout(nextHintTimer.current)
                    nextHintTimer.current = setTimeout(() => setShowNextHint(false), 3000)
                  }}
                  accessible={false}
                />
              )}
            </View>
          ) : (
            <View style={styles.headerAction} />
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {step === 1 && showNextHint && !form.canAdvance && (
          <Text
            style={styles.nextHint}
            accessibilityLiveRegion="polite"
            accessibilityRole="text"
          >
            {form.media.length === 0 && form.title.trim().length < 3
              ? 'Add a photo and a title to continue'
              : form.media.length === 0
              ? 'Add a photo to continue'
              : 'Your title needs at least 3 characters'}
          </Text>
        )}
        {step === 1 && <StepMedia {...mediaProps} />}
        {step === 2 && <StepDetails {...detailsProps} />}
        {step === 3 && <StepReview {...reviewProps} />}
      </KeyboardAvoidingView>
      <CreatePostSheets {...sheetProps} />
    </SafeAreaView>
  )
}
