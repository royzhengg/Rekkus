import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/lib/contexts/ToastContext'
import type { CreatePostDraft, CreatePostDraftStatus } from '@/lib/services/postDrafts'
import { listCreatePostDraftSummaries, loadCreatePostDraft, saveCreatePostDraft } from '@/lib/services/postDrafts'

type EntryMode = 'loading' | 'choosing' | 'editing'

interface DraftLoaderParams {
  draftId: string | undefined
  intent: string | undefined
  nonce: string | undefined
  userId: string | undefined
  isEditingPost: boolean
  hasDraftContent: boolean
  currentDraftStatus: CreatePostDraftStatus | undefined
  buildDraft: () => CreatePostDraft
  setCurrentDraftId: (id: string | undefined) => void
  setCurrentDraftStatus: (status: CreatePostDraftStatus | undefined) => void
  applyDraftToForm: (draft: CreatePostDraft) => void
  clearFormFields: () => void
}

export function useCreatePostDraftLoader({
  draftId,
  intent,
  nonce,
  userId,
  isEditingPost,
  hasDraftContent,
  currentDraftStatus,
  buildDraft,
  setCurrentDraftId,
  setCurrentDraftStatus,
  applyDraftToForm,
  clearFormFields,
}: DraftLoaderParams) {
  const { showToast } = useToast()
  const [entryMode, setEntryMode] = useState<EntryMode>(draftId ? 'editing' : 'loading')

  const refreshDraftSummaries = useCallback(async () => {
    if (!userId) return []
    const items = await listCreatePostDraftSummaries()
    return items
  }, [userId])

  useEffect(() => {
    if (!userId) return
    if (isEditingPost) { setEntryMode('editing'); return }
    if (draftId) { setEntryMode('editing'); return }
    if (intent === 'new' || intent === 'choose') {
      clearFormFields()
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
  }, [draftId, intent, nonce, userId, isEditingPost, refreshDraftSummaries, clearFormFields])

  useEffect(() => {
    if (!draftId) return
    let mounted = true
    void loadCreatePostDraft(draftId).then(result => {
      if (!mounted || !result) return
      applyDraftToForm(result.draft)
      if (result.placeCleared) {
        showToast("The place you tagged is no longer available — please re-select.")
      }
      setEntryMode('editing')
    })
    return () => { mounted = false }
  }, [draftId, applyDraftToForm, showToast])

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
  }, [hasDraftContent, entryMode, currentDraftStatus, isEditingPost, buildDraft, refreshDraftSummaries, setCurrentDraftId, setCurrentDraftStatus])

  return { entryMode, setEntryMode, refreshDraftSummaries }
}
