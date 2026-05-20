import React, { createContext, useContext, useMemo, useState } from 'react'
import type { PostMediaAsset } from '@/types/domain'
import { analytics } from '@/lib/analytics'

export type PostUploadJobStatus = 'preparing' | 'uploading' | 'publishing' | 'posted' | 'failed'

export type PostUploadJob = {
  id: string
  title: string
  coverUri?: string
  progress: number
  status: PostUploadJobStatus
  error?: string | null
  media?: PostMediaAsset[]
}

type ContextValue = {
  jobs: PostUploadJob[]
  startJob: (job: Omit<PostUploadJob, 'progress' | 'status'>) => string
  updateJob: (id: string, patch: Partial<PostUploadJob>) => void
  completeJob: (id: string) => void
  failJob: (id: string, error: string) => void
  clearJob: (id: string) => void
}

const PostUploadContext = createContext<ContextValue>({
  jobs: [],
  startJob: () => '',
  updateJob: () => {},
  completeJob: () => {},
  failJob: () => {},
  clearJob: () => {},
})

export function PostUploadProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<PostUploadJob[]>([])

  const value = useMemo<ContextValue>(() => ({
    jobs,
    startJob(job) {
      const id = job.id
      setJobs(prev => [{ ...job, id, status: 'preparing', progress: 0.08 }, ...prev])
      analytics.mediaEvent(null, 'post_upload_started', 'post_create', { status: 'preparing' })
      return id
    },
    updateJob(id, patch) {
      setJobs(prev => prev.map(job => (job.id === id ? { ...job, ...patch } : job)))
      if (typeof patch.progress === 'number') {
        analytics.mediaEvent(null, 'post_upload_progress', 'post_create', {
          progress: patch.progress,
          status: patch.status ?? null,
        })
      }
    },
    completeJob(id) {
      setJobs(prev => prev.map(job => (job.id === id ? { ...job, status: 'posted', progress: 1 } : job)))
      analytics.mediaEvent(null, 'post_published', 'post_create')
      setTimeout(() => setJobs(prev => prev.filter(job => job.id !== id)), 2200)
    },
    failJob(id, error) {
      setJobs(prev => prev.map(job => (job.id === id ? { ...job, status: 'failed', error, progress: 1 } : job)))
      analytics.mediaEvent(null, 'post_upload_failed', 'post_create', { status: 'failed', reason: error })
    },
    clearJob(id) {
      setJobs(prev => prev.filter(job => job.id !== id))
    },
  }), [jobs])

  return <PostUploadContext.Provider value={value}>{children}</PostUploadContext.Provider>
}

export function usePostUploadQueue(): ContextValue {
  return useContext(PostUploadContext)
}
