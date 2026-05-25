import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system'
import { supabase } from '@/lib/supabase'
import { parseJsonWithGuard } from '@/lib/utils/safeJson'
import type { PostMedia } from '@/types/domain'
import { reportInvalidBoundary } from './boundaryTelemetry'
import {
  isLocalDraft,
  isLocalDraftList,
  isRemoteDraftRow,
  isRemoteDraftSummaryRow,
  isRemoteDraftTitleRow,
  type RemoteDraftRow,
} from './postDrafts/guards'
import type { CreatePostDraft, CreatePostDraftStatus, CreatePostDraftSummary, SaveOptions } from './postDrafts/types'

export type { CreatePostDraft, CreatePostDraftMedia, CreatePostDraftStatus, CreatePostDraftSummary, CreatePostDraftSyncStatus } from './postDrafts/types'

const LEGACY_DRAFT_KEY = 'rekkus:create-post-draft:v1'
const LOCAL_DRAFT_LIST_KEY = 'rekkus:create-post-drafts:v2'
const MIGRATION_KEY_PREFIX = 'rekkus:create-post-drafts:migrated'
const DRAFT_BUCKET = 'post-drafts'

function localDraftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isUuid(value: string | undefined): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function readLocalDraftsRaw(): Promise<CreatePostDraft[]> {
  const raw = await AsyncStorage.getItem(LOCAL_DRAFT_LIST_KEY)
  if (raw) {
    const parsed = parseJsonWithGuard(raw, isLocalDraftList)
    if (parsed) return parsed
    else {
      reportInvalidBoundary('post_draft_cache_invalid')
      await AsyncStorage.removeItem(LOCAL_DRAFT_LIST_KEY)
    }
  }

  const legacy = await AsyncStorage.getItem(LEGACY_DRAFT_KEY)
  if (!legacy) return []
  const parsed = parseJsonWithGuard(legacy, isLocalDraft)
  if (parsed) {
    const migrated = {
      ...parsed,
      id: parsed.id ?? localDraftId(),
      status: parsed.status ?? 'saved',
      syncStatus: 'local' as const,
      createdAt: parsed.createdAt ?? parsed.updatedAt,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    }
    await AsyncStorage.setItem(LOCAL_DRAFT_LIST_KEY, JSON.stringify([migrated]))
    await AsyncStorage.removeItem(LEGACY_DRAFT_KEY)
    return [migrated]
  }
  reportInvalidBoundary('legacy_post_draft_cache_invalid')
  await AsyncStorage.removeItem(LEGACY_DRAFT_KEY)
  return []
}

async function writeLocalDrafts(drafts: CreatePostDraft[]): Promise<void> {
  await AsyncStorage.setItem(
    LOCAL_DRAFT_LIST_KEY,
    JSON.stringify([...drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
  )
}

async function upsertLocalDraft(draft: CreatePostDraft): Promise<CreatePostDraft> {
  const now = new Date().toISOString()
  const nextDraft = {
    ...draft,
    id: draft.id ?? draft.remoteId ?? localDraftId(),
    status: draft.status ?? 'autosave',
    syncStatus: draft.syncStatus ?? 'local',
    createdAt: draft.createdAt ?? now,
    updatedAt: now,
  }
  const drafts = await readLocalDraftsRaw()
  const idx = drafts.findIndex(item => item.id === nextDraft.id || item.remoteId === nextDraft.remoteId)
  const next = idx >= 0 ? drafts.map(item => (item === drafts[idx] ? nextDraft : item)) : [nextDraft, ...drafts]
  await writeLocalDrafts(next)
  return nextDraft
}

async function currentUserId(explicitUserId?: string | null): Promise<string | null> {
  if (explicitUserId) return explicitUserId
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

function draftTitle(draft: Pick<CreatePostDraft, 'title' | 'body'>): string {
  return draft.title.trim() || draft.body.trim() || 'Untitled draft'
}

export function getNextDuplicateDraftTitle(baseTitle: string, existingTitles: string[]): string {
  const base = baseTitle.trim() || 'Untitled draft'
  const existing = new Set(existingTitles.map(title => title.trim()).filter(Boolean))
  let suffix = 1
  let candidate = `${base} (${suffix})`
  while (existing.has(candidate)) {
    suffix += 1
    candidate = `${base} (${suffix})`
  }
  return candidate
}

function extForMedia(media: PostMedia): string {
  const raw = media.uri.split('?')[0]?.split('.').pop()?.toLowerCase()
  if (raw && /^[a-z0-9]+$/.test(raw) && raw.length <= 5) return raw
  if (media.type === 'video') return 'mp4'
  if (media.mimeType?.includes('png')) return 'png'
  if (media.mimeType?.includes('webp')) return 'webp'
  if (media.mimeType?.includes('heic')) return 'heic'
  return 'jpg'
}

function mimeForMedia(media: PostMedia): string {
  if (media.mimeType) return media.mimeType
  if (media.type === 'video') return 'video/mp4'
  const ext = extForMedia(media)
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'heic') return 'image/heic'
  if (ext === 'heif') return 'image/heif'
  return 'image/jpeg'
}

function isRemoteUri(uri: string): boolean {
  return /^https?:\/\//i.test(uri)
}

async function signedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage.from(DRAFT_BUCKET).createSignedUrl(path, 60 * 60 * 24)
  if (error) return null
  return data.signedUrl
}

async function uploadOneDraftMedia(
  userId: string,
  draftId: string,
  media: PostMedia,
  index: number
): Promise<PostMedia> {
  if (media.storagePath) return media
  if (isRemoteUri(media.uri)) return media

  const info = await FileSystem.getInfoAsync(media.uri)
  if (!info.exists) throw new Error('Draft media file was not found on this device.')

  const ext = extForMedia(media)
  const storagePath = `${userId}/${draftId}/${media.localId || `media-${index}`}.${ext}`
  const fileContent = await FileSystem.readAsStringAsync(media.uri, { encoding: 'base64' as const })
  const { error } = await supabase.storage.from(DRAFT_BUCKET).upload(storagePath, decode(fileContent), {
    contentType: mimeForMedia(media),
    upsert: true,
  })
  if (error) throw error
  return { ...media, storagePath, processingStatus: media.processingStatus ?? 'ready' }
}

export async function uploadDraftMedia(draftId: string, media: PostMedia[], userId?: string | null): Promise<PostMedia[]> {
  const ownerId = await currentUserId(userId)
  if (!ownerId) return media
  const uploaded: PostMedia[] = []
  for (let i = 0; i < media.length; i++) {
    const item = media[i]
    if (item) uploaded.push(await uploadOneDraftMedia(ownerId, draftId, item, i))
  }
  return uploaded
}

function draftPayload(draft: CreatePostDraft, userId: string, status: CreatePostDraftStatus) {
  const restaurantId = draft.selectedPlace?.restaurantId
  return {
    user_id: userId,
    title: draft.title ?? '',
    body: draft.body ?? '',
    selected_place: draft.selectedPlace ?? null,
    restaurant_id: isUuid(restaurantId) ? restaurantId : null,
    dish_tags: draft.dishTags ?? [],
    food_rating: draft.foodRating ?? 0,
    vibe_rating: draft.vibeRating ?? 0,
    cost_rating: draft.costRating ?? 0,
    taste_verdict: draft.tasteVerdict ?? null,
    value_verdict: draft.valueVerdict ?? null,
    occasion_tags: draft.occasionTags ?? [],
    best_dish: draft.bestDish ?? '',
    cuisine_type: draft.cuisineType ?? '',
    hashtags: draft.hashtags ?? [],
    hashtag_input: draft.hashtagInput ?? '',
    status,
    last_saved_at: status === 'saved' ? new Date().toISOString() : draft.lastSavedAt ?? null,
    updated_at: new Date().toISOString(),
  }
}

async function syncDraftMediaRows(draftId: string, userId: string, media: PostMedia[]): Promise<void> {
  await supabase.from('post_draft_media').delete().eq('draft_id', draftId).eq('user_id', userId)
  if (media.length === 0) return
  const rows = media.flatMap((item, index) => {
    const storagePath = item.storagePath
    if (!storagePath) return []
    return [{
      draft_id: draftId,
      user_id: userId,
      local_id: item.localId,
      media_type: item.type,
      storage_path: storagePath,
      public_preview_url: null,
      thumbnail_url: item.thumbnailUrl ?? null,
      mime_type: item.mimeType ?? null,
      size_bytes: item.sizeBytes ?? null,
      duration_ms: item.durationMs ?? null,
      width: item.width ?? null,
      height: item.height ?? null,
      processing_status: item.processingStatus ?? 'ready',
      processing_error: item.processingError ?? null,
      order_index: index,
      is_cover: item.isCover ?? index === 0,
    }]
  })
  if (rows.length > 0) await supabase.from('post_draft_media').insert(rows)
}

async function saveRemoteDraft(draft: CreatePostDraft, options: SaveOptions): Promise<CreatePostDraft> {
  const userId = await currentUserId(options.userId)
  if (!userId) return upsertLocalDraft({ ...draft, status: options.visible ? 'saved' : 'autosave' })

  const status: CreatePostDraftStatus = options.visible ? 'saved' : 'autosave'
  const id = isUuid(draft.remoteId) ? draft.remoteId : isUuid(draft.id) ? draft.id : undefined
  const payload = draftPayload(draft, userId, status)

  const result = id
    ? await supabase.from('post_drafts')
        .update(payload)
        .eq('id', id)
        .eq('user_id', userId)
        .select('id, created_at, updated_at, last_saved_at, status')
        .single()
    : await supabase.from('post_drafts')
        .insert(payload)
        .select('id, created_at, updated_at, last_saved_at, status')
        .single()

  if (result.error || !result.data) {
    return upsertLocalDraft({
      ...draft,
      status,
      syncStatus: 'failed',
    })
  }

  const remoteId = result.data.id
  try {
    const uploadedMedia = await uploadDraftMedia(remoteId, draft.media, userId)
    await syncDraftMediaRows(remoteId, userId, uploadedMedia)
    const synced: CreatePostDraft = {
      ...draft,
      id: remoteId,
      remoteId,
      userId,
      status: result.data.status === 'autosave' || result.data.status === 'saved' || result.data.status === 'discarded' || result.data.status === 'published'
        ? result.data.status
        : status,
      syncStatus: 'synced' as const,
      media: uploadedMedia,
      createdAt: result.data.created_at,
      updatedAt: result.data.updated_at,
      lastSavedAt: result.data.last_saved_at,
    }
    await upsertLocalDraft(synced)
    return synced
  } catch {
    const failed = {
      ...draft,
      id: remoteId,
      remoteId,
      userId,
      status,
      syncStatus: 'failed' as const,
      updatedAt: new Date().toISOString(),
    }
    await upsertLocalDraft(failed)
    return failed
  }
}

export async function saveCreatePostDraftRemote(
  draft: CreatePostDraft,
  options: SaveOptions
): Promise<CreatePostDraft> {
  return saveRemoteDraft(draft, options)
}

export async function saveCreatePostDraft(draft: CreatePostDraft): Promise<CreatePostDraft> {
  return saveRemoteDraft(draft, { visible: draft.status === 'saved', userId: draft.userId })
}

async function mapRemoteDraft(row: RemoteDraftRow): Promise<CreatePostDraft> {
  const mediaRows = [...(row.post_draft_media ?? [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  const media: PostMedia[] = await Promise.all(mediaRows.map(async (item): Promise<PostMedia> => {
    const url = await signedUrl(item.storage_path)
    return {
      id: item.id,
      localId: item.local_id,
      uri: url ?? item.public_preview_url ?? item.thumbnail_url ?? '',
      type: item.media_type,
      storagePath: item.storage_path,
      thumbnailUrl: item.thumbnail_url ?? url ?? null,
      mimeType: item.mime_type ?? null,
      sizeBytes: item.size_bytes ?? null,
      durationMs: item.duration_ms ?? null,
      width: item.width ?? null,
      height: item.height ?? null,
      processingStatus:
        item.processing_status === 'local_ready' || item.processing_status === 'queued' ||
        item.processing_status === 'preparing' || item.processing_status === 'ready' ||
        item.processing_status === 'failed' || item.processing_status === 'uploading' ||
        item.processing_status === 'uploaded' || item.processing_status === 'processing'
          ? item.processing_status
          : 'ready',
      processingError: item.processing_error ?? null,
      isCover: item.is_cover ?? false,
    }
  }))
  return {
    id: row.id,
    remoteId: row.id,
    userId: row.user_id,
    status: row.status,
    syncStatus: 'synced',
    media,
    title: row.title ?? '',
    selectedPlace: row.selected_place ?? null,
    dishTags: row.dish_tags ?? [],
    foodRating: row.food_rating ?? 0,
    vibeRating: row.vibe_rating ?? 0,
    costRating: row.cost_rating ?? 0,
    tasteVerdict: row.taste_verdict ?? undefined,
    valueVerdict: row.value_verdict ?? undefined,
    occasionTags: row.occasion_tags ?? [],
    body: row.body ?? '',
    bestDish: row.best_dish ?? '',
    cuisineType: row.cuisine_type ?? '',
    hashtags: row.hashtags ?? [],
    hashtagInput: row.hashtag_input ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSavedAt: row.last_saved_at,
  }
}

export async function listSavedCreatePostDrafts(userId?: string | null): Promise<CreatePostDraftSummary[]> {
  const ownerId = await currentUserId(userId)
  if (!ownerId) {
    const local = await readLocalDraftsRaw()
    return local
      .filter(draft => draft.status === 'saved')
      .map(draft => ({
        id: draft.remoteId ?? draft.id ?? localDraftId(),
        title: draftTitle(draft),
        restaurantName: draft.selectedPlace?.name,
        coverUri: draft.media[0]?.thumbnailUrl ?? draft.media[0]?.uri,
        mediaCount: draft.media.length,
        updatedAt: draft.updatedAt,
        lastSavedAt: draft.lastSavedAt,
        syncStatus: draft.syncStatus,
      }))
  }

  await migrateLocalDraftsToRemote(ownerId)
  const { data, error } = await supabase.from('post_drafts')
    .select('id, title, body, selected_place, updated_at, last_saved_at, status, post_draft_media ( storage_path, thumbnail_url, order_index )')
    .eq('user_id', ownerId)
    .eq('status', 'saved')
    .order('last_saved_at', { ascending: false })
    .limit(100)
  if (error || !data) return []

  return Promise.all(data.map(row => isRemoteDraftSummaryRow(row) ? row : null).filter((draft): draft is NonNullable<typeof draft> => draft !== null).map(async (draft) => {
    const mediaRows = [...(draft.post_draft_media ?? [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    const cover = mediaRows[0]
    return {
      id: draft.id,
      title: draft.title?.trim() || draft.body?.trim() || 'Untitled draft',
      restaurantName: draft.selected_place?.name,
      coverUri: cover?.thumbnail_url ?? await signedUrl(cover?.storage_path) ?? undefined,
      mediaCount: mediaRows.length,
      updatedAt: draft.updated_at,
      lastSavedAt: draft.last_saved_at,
      syncStatus: 'synced' as const,
    }
  }))
}

export async function listCreatePostDraftSummaries(): Promise<CreatePostDraftSummary[]> {
  return listSavedCreatePostDrafts()
}

export async function listCreatePostDrafts(): Promise<CreatePostDraft[]> {
  const ownerId = await currentUserId()
  if (!ownerId) return readLocalDraftsRaw()
  await migrateLocalDraftsToRemote(ownerId)
  const { data, error } = await supabase.from('post_drafts')
    .select('*, post_draft_media ( * )')
    .eq('user_id', ownerId)
    .eq('status', 'saved')
    .order('last_saved_at', { ascending: false })
    .limit(100)
  if (error || !data) return readLocalDraftsRaw()
  const rows = data.map((row: unknown) => isRemoteDraftRow(row) ? row : null).filter((row): row is RemoteDraftRow => row !== null)
  return Promise.all(rows.map((row) => mapRemoteDraft(row)))
}

async function listSavedDraftTitles(userId?: string | null): Promise<string[]> {
  const ownerId = await currentUserId(userId)
  if (!ownerId) {
    const local = await readLocalDraftsRaw()
    return local.filter(draft => draft.status === 'saved').map(draft => draftTitle(draft))
  }

  const { data, error } = await supabase.from('post_drafts')
    .select('title, body')
    .eq('user_id', ownerId)
    .eq('status', 'saved')
    .limit(500)
  if (error || !data) {
    const local = await readLocalDraftsRaw()
    return local.filter(draft => draft.status === 'saved').map(draft => draftTitle(draft))
  }
  return data.filter(isRemoteDraftTitleRow).map((draft) => draft.title?.trim() || draft.body?.trim() || 'Untitled draft')
}

export async function saveCreatePostDraftAsNew(
  draft: CreatePostDraft,
  userId?: string | null
): Promise<CreatePostDraft> {
  const titles = await listSavedDraftTitles(userId ?? draft.userId)
  const copy = {
    ...draft,
    id: undefined,
    remoteId: undefined,
    title: getNextDuplicateDraftTitle(draftTitle(draft), titles),
    status: 'saved' as const,
    syncStatus: 'syncing' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastSavedAt: new Date().toISOString(),
  }
  return saveCreatePostDraftRemote(copy, { visible: true, userId: userId ?? draft.userId })
}

export async function loadCreatePostDraft(id?: string): Promise<CreatePostDraft | null> {
  const ownerId = await currentUserId()
  if (ownerId) await migrateLocalDraftsToRemote(ownerId)
  if (ownerId && id && isUuid(id)) {
    const { data, error } = await supabase.from('post_drafts')
      .select('*, post_draft_media ( * )')
      .eq('id', id)
      .eq('user_id', ownerId)
      .neq('status', 'discarded')
      .neq('status', 'published')
      .single()
    if (!error && isRemoteDraftRow(data)) return mapRemoteDraft(data)
  }
  const drafts = await readLocalDraftsRaw()
  return (id ? drafts.find(draft => draft.id === id || draft.remoteId === id) : drafts[0]) ?? null
}

export async function deleteCreatePostDraft(id: string): Promise<void> {
  const ownerId = await currentUserId()
  if (ownerId && isUuid(id)) {
    await supabase.from('post_drafts')
      .update({ status: 'discarded', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', ownerId)
  }
  const drafts = await readLocalDraftsRaw()
  await writeLocalDrafts(drafts.filter(draft => draft.id !== id && draft.remoteId !== id))
}

export async function duplicateCreatePostDraft(id: string): Promise<CreatePostDraft | null> {
  const draft = await loadCreatePostDraft(id)
  if (!draft) return null
  return saveCreatePostDraftAsNew(draft, draft.userId)
}

export async function markCreatePostDraftPublished(id?: string): Promise<void> {
  if (!id) return
  const ownerId = await currentUserId()
  if (ownerId && isUuid(id)) {
    await supabase.from('post_drafts')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', ownerId)
  }
  const drafts = await readLocalDraftsRaw()
  await writeLocalDrafts(drafts.filter(draft => draft.id !== id && draft.remoteId !== id))
}

export async function clearCreatePostDraft(id?: string): Promise<void> {
  if (!id) {
    const drafts = await readLocalDraftsRaw()
    const firstDraft = drafts[0]
    if (firstDraft?.id) await deleteCreatePostDraft(firstDraft.remoteId ?? firstDraft.id)
    return
  }
  await deleteCreatePostDraft(id)
}

async function migrateLocalDraftsToRemote(userId: string): Promise<void> {
  const migrationKey = `${MIGRATION_KEY_PREFIX}:${userId}`
  if (await AsyncStorage.getItem(migrationKey)) return
  const local = await readLocalDraftsRaw()
  const candidates = local.filter(
    draft =>
      (!draft.remoteId || draft.syncStatus === 'failed') &&
      draft.status === 'saved' &&
      draft.media.length + draft.title.trim().length + draft.body.trim().length > 0
  )
  let allSynced = true
  for (const draft of candidates) {
    const synced = await saveCreatePostDraftRemote({ ...draft, userId, status: 'saved' }, { visible: true, userId })
    if (synced.syncStatus !== 'synced' || !synced.remoteId) allSynced = false
  }
  if (allSynced) await AsyncStorage.setItem(migrationKey, 'true')
}

function decode(base64: string): Uint8Array {
  const binaryStr = atob(base64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return bytes
}
