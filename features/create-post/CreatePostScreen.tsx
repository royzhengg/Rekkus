import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'expo-router'
import { useLocalSearchParams } from 'expo-router'
import { useThemeColors } from '@/lib/contexts/ThemeContext'
import { ChevronLeft } from '@/components/icons'
import { usePosts } from '@/lib/contexts/PostsContext'
import { useAuth } from '@/lib/contexts/AuthContext'
import { useAuthGate } from '@/lib/contexts/AuthGateContext'
import StepMedia from '@/components/post-create/StepMedia'
import StepDetails from '@/components/post-create/StepDetails'
import StepReview from '@/components/post-create/StepReview'
import type { SelectedPlace } from '@/lib/services/restaurants'
import {
  clearCreatePostDraft,
  listCreatePostDraftSummaries,
  loadCreatePostDraft,
  markCreatePostDraftPublished,
  saveCreatePostDraftAsNew,
  saveCreatePostDraftRemote,
  saveCreatePostDraft,
} from '@/lib/services/postDrafts'
import type { CreatePostDraft, CreatePostDraftStatus } from '@/lib/services/postDrafts'
import { usePostUploadQueue } from '@/lib/contexts/PostUploadContext'
import { enqueueServerMediaProcessing } from '@/lib/services/postMediaProcessing'
import { tasteToLegacyFood, valueToLegacyCost } from '@/lib/dataSources/rekkusPicks'
import type { DishTag, PostMedia, RekkusOccasionTag, RekkusTasteVerdict, RekkusValueVerdict } from '@/types/domain'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import { createPost, loadPostForEditing, recordPostEditEvent, updatePost } from '@/lib/services/posts'
import { analytics } from '@/lib/analytics'
import { spacing } from '@/constants/Spacing'
import { radius } from '@/constants/Radius'
import { fontSize, fontWeight } from '@/constants/Typography'

type Step = 1 | 2 | 3
type EntryMode = 'loading' | 'choosing' | 'editing'
type SaveDraftMode = 'update' | 'new'
type DraftNotice = {
  title: string
  subtitle: string
}

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

  async function refreshDraftSummaries() {
    if (!user?.id) return []
    const items = await listCreatePostDraftSummaries()
    return items
  }

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
      refreshDraftSummaries().then(items => {
        setEntryMode(items.length > 0 ? 'choosing' : 'editing')
      })
      return
    }
    refreshDraftSummaries().then(items => {
      setEntryMode(items.length > 0 ? 'choosing' : 'editing')
    })
  }, [draftId, intent, nonce, user?.id, isEditingPost])

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
    loadCreatePostDraft(draftId).then(draft => {
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
    loadPostForEditing(postId).then(post => {
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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasDraftContent) return
      if (entryMode !== 'editing') return
      if (isEditingPost) return
      if (currentDraftStatus === 'saved') return
      saveCreatePostDraft(buildDraft()).then(saved => {
        setCurrentDraftId(saved.remoteId ?? saved.id)
        setCurrentDraftStatus(saved.status)
        refreshDraftSummaries()
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [
    hasDraftContent,
    media,
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
    entryMode,
    currentDraftStatus,
    isEditingPost,
  ])

  if (!user) return null

  function buildDraft(): CreatePostDraft {
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
  }

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
    saveDraftWithMode('update')
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
        router.replace(`/posts/${postId}` as any)
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
        dishTags,
        media,
      })
      clearForm()
      await markCreatePostDraftPublished(currentDraftId)
      uploadQueue.completeJob(jobId)
      await refresh()
      setPosting(false)
      router.replace('/(tabs)/feed')
    } catch (err) {
      console.error('[handlePost]', err)
      uploadQueue.failJob(jobId, 'post_failed')
      setPosting(false)
      setDraftNotice({
        title: 'Could not publish post',
        subtitle: 'Your draft is still here. Check your connection and try again.',
      })
    }
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
              router.push('/create/drafts' as any)
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {step === 1 && (
          <StepMedia
            media={media}
            setMedia={setMedia}
            title={title}
            setTitle={setTitle}
            selectedPlace={selectedPlace}
            setSelectedPlace={setSelectedPlace}
            cuisineType={cuisineType}
            dishTags={dishTags}
            setDishTags={setDishTags}
          />
        )}
        {step === 2 && (
          <StepDetails
            foodRating={foodRating}
            setFoodRating={setFoodRating}
            vibeRating={vibeRating}
            setVibeRating={setVibeRating}
            costRating={costRating}
            setCostRating={setCostRating}
            tasteVerdict={tasteVerdict}
            setTasteVerdict={setTasteVerdict}
            valueVerdict={valueVerdict}
            setValueVerdict={setValueVerdict}
            occasionTags={occasionTags}
            setOccasionTags={setOccasionTags}
            body={body}
            setBody={setBody}
            bestDish={bestDish}
            setBestDish={setBestDish}
            cuisineType={cuisineType}
            setCuisineType={setCuisineType}
            hashtags={hashtags}
            setHashtags={setHashtags}
            hashtagInput={hashtagInput}
            setHashtagInput={setHashtagInput}
          />
        )}
        {step === 3 && (
          <StepReview
            title={title}
            body={body}
            media={media}
            selectedPlace={selectedPlace}
            foodRating={foodRating}
            vibeRating={vibeRating}
            costRating={costRating}
            tasteVerdict={tasteVerdict}
            valueVerdict={valueVerdict}
            occasionTags={occasionTags}
            cuisineType={cuisineType}
            bestDish={bestDish}
            hashtags={hashtags}
            onEditBasics={() => setStep(1)}
            onEditDetails={() => setStep(2)}
            onPost={handlePost}
            primaryLabel={isEditingPost ? 'Save changes' : 'Post review'}
            posting={posting}
            onSaveDraft={openSaveDraftOptions}
            savingDraft={savingDraft}
          />
        )}
      </KeyboardAvoidingView>
      <RekkusActionSheet
        visible={saveSheetVisible}
        title="Save draft"
        subtitle="Update this draft, or keep it unchanged and save a new version."
        options={[
          { label: 'Save draft', value: 'update' },
          { label: 'Save as new draft', value: 'new' },
        ]}
        onSelect={value => saveDraftWithMode(value as SaveDraftMode)}
        onDismiss={() => setSaveSheetVisible(false)}
      />
      <RekkusActionSheet
        visible={draftNotice != null}
        title={draftNotice?.title}
        subtitle={draftNotice?.subtitle}
        options={[
          { label: 'Keep editing', value: 'keep' },
          { label: 'Done', value: 'done' },
        ]}
        onSelect={value => {
          if (value === 'done') router.replace('/(tabs)/feed')
        }}
        onDismiss={() => setDraftNotice(null)}
      />
      <RekkusActionSheet
        visible={leaveConfirmVisible}
        title={isEditingPost ? 'Discard edits?' : 'Leave this post?'}
        subtitle={isEditingPost ? 'Your changes are not saved yet.' : 'Save this as a draft, or discard it before leaving.'}
        options={[
          { label: 'Keep editing', value: 'keep' },
          ...(!isEditingPost ? [{ label: 'Save draft', value: 'save', accentColor: c.accent }] : []),
          { label: 'Discard', value: 'discard', destructive: true },
        ]}
        onSelect={async value => {
          if (value === 'keep') return
          if (value === 'save') {
            await saveDraftWithMode('update', { showConfirmation: false })
            router.replace('/(tabs)/feed')
            return
          }
          if (value === 'discard') {
            if (isEditingPost && postId && user?.id) {
              recordPostEditEvent(postId, user.id, 'edit_discarded').catch(() => {})
            }
            if (currentDraftId) await clearCreatePostDraft(currentDraftId)
            clearForm()
            router.replace('/(tabs)/feed')
          }
        }}
        onDismiss={() => setLeaveConfirmVisible(false)}
      />
      <RekkusActionSheet
        visible={editConflictVisible}
        title="Review latest changes"
        subtitle="This post changed while you were editing. Your edits are still here."
        options={[
          { label: 'Review latest', value: 'latest', accentColor: c.accent },
          { label: 'Save as draft', value: 'draft' },
          { label: 'Discard changes', value: 'discard', destructive: true },
        ]}
        onSelect={async value => {
          if (value === 'latest' && postId) {
            router.replace(`/posts/${postId}` as any)
            return
          }
          if (value === 'draft') {
            await saveDraftWithMode('new', { showConfirmation: true })
            return
          }
          if (value === 'discard') {
            if (postId && user?.id) {
              recordPostEditEvent(postId, user.id, 'edit_discarded').catch(() => {})
            }
            clearForm()
            if (postId) router.replace(`/posts/${postId}` as any)
          }
        }}
        onDismiss={() => setEditConflictVisible(false)}
      />
    </SafeAreaView>
  )
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    choiceHeader: {
      minHeight: 56,
      justifyContent: 'center',
      paddingHorizontal: spacing[5],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    choiceTitle: { fontSize: fontSize['2.5xl'], fontWeight: fontWeight.extrabold, color: c.text },
    choiceScroll: { flex: 1 },
    choiceContent: { padding: spacing[5], paddingBottom: spacing.px40, gap: spacing[3] },
    newPostCard: {
      borderRadius: radius.sm3,
      backgroundColor: c.text,
      paddingHorizontal: spacing.px18,
      paddingVertical: spacing[4],
    },
    newPostTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: c.bg },
    newPostSub: { fontSize: fontSize.base, color: c.bg, opacity: 0.68, marginTop: spacing.px3 },
    choiceSectionHeader: {
      marginTop: spacing.px10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    choiceSectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
    choiceSectionAction: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: c.accent },
    choiceDraftRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
      paddingVertical: spacing.px10,
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    choiceThumb: {
      width: 52,
      height: 52,
      borderRadius: radius.sm3,
      backgroundColor: c.surface2,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    choiceDraftInfo: { flex: 1 },
    choiceDraftTitle: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: c.text },
    choiceDraftMeta: { fontSize: fontSize.bodySm, color: c.text3, marginTop: spacing.px3 },
    topBar: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      borderBottomWidth: 0.5,
      borderBottomColor: c.border,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      minHeight: 40,
      paddingHorizontal: spacing[0],
      marginLeft: -spacing.px6,
      width: 96,
    },
    backText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text2 },
    centerWrap: { alignItems: 'center', gap: spacing[1] },
    stepTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
    dots: { flexDirection: 'row', gap: spacing.px5 },
    dot: {
      width: 6,
      height: 6,
      borderRadius: radius.tiny,
      backgroundColor: c.border2,
    },
    dotActive: { width: 18, backgroundColor: c.accent },
    rightActions: {
      width: 96,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: spacing.px2,
    },
    draftsText: {
      fontSize: fontSize.bodySm,
      fontWeight: fontWeight.semibold,
      color: c.text2,
    },
    saveText: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      color: c.accent,
    },
    saveTextDisabled: { color: c.text3, opacity: 0.55 },
    headerAction: {
      minWidth: 42,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nextBtn: {
      minWidth: 42,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nextBtnDisabled: { opacity: 0.5 },
    nextBtnText: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      color: c.accent,
    },
    nextBtnTextDisabled: { color: c.text3 },
  })
}
