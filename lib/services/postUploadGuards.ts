import type { PostMediaAsset, PostMediaProcessingStatus } from '@/types/domain'
import { isRecord } from '../utils/safeJson'

export type PersistedUploadJobStatus = 'preparing' | 'uploading' | 'publishing' | 'posted' | 'failed'
export type PersistedUploadJob = {
  id: string
  title: string
  coverUri?: string | undefined
  progress: number
  status: PersistedUploadJobStatus
  error?: string | null | undefined
  media?: PostMediaAsset[] | undefined
}

function isStatus(value: unknown): value is PersistedUploadJobStatus {
  return value === 'preparing' || value === 'uploading' || value === 'publishing' || value === 'posted' || value === 'failed'
}

function isMediaStatus(value: unknown): value is PostMediaProcessingStatus {
  return (
    value === 'local_ready' || value === 'queued' || value === 'preparing' || value === 'ready' ||
    value === 'failed' || value === 'uploading' || value === 'uploaded' || value === 'processing'
  )
}

function isMedia(value: unknown): value is PostMediaAsset {
  return (
    isRecord(value) &&
    typeof value.localId === 'string' &&
    typeof value.uri === 'string' &&
    (value.type === 'image' || value.type === 'video') &&
    (value.processingStatus === undefined || isMediaStatus(value.processingStatus))
  )
}

export function isPostUploadJob(value: unknown): value is PersistedUploadJob {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.progress === 'number' &&
    isStatus(value.status) &&
    (value.coverUri === undefined || typeof value.coverUri === 'string') &&
    (value.error === undefined || value.error === null || typeof value.error === 'string') &&
    (value.media === undefined || (Array.isArray(value.media) && value.media.every(isMedia)))
  )
}

export function isPostUploadJobList(value: unknown): value is PersistedUploadJob[] {
  return Array.isArray(value) && value.every(isPostUploadJob)
}
