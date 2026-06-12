import React from 'react'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import type { ColorTokens } from '@/lib/contexts/ThemeContext'

export type SaveDraftMode = 'update' | 'new'
export type DraftNotice = {
  title: string
  subtitle: string
}

type Props = {
  colors: ColorTokens
  saveSheetVisible: boolean
  setSaveSheetVisible: React.Dispatch<React.SetStateAction<boolean>>
  draftNotice: DraftNotice | null
  setDraftNotice: React.Dispatch<React.SetStateAction<DraftNotice | null>>
  leaveConfirmVisible: boolean
  setLeaveConfirmVisible: React.Dispatch<React.SetStateAction<boolean>>
  editConflictVisible: boolean
  setEditConflictVisible: React.Dispatch<React.SetStateAction<boolean>>
  isEditingPost: boolean
  onSaveDraft: (mode: SaveDraftMode, options?: { showConfirmation?: boolean }) => Promise<void>
  onDraftDone: () => void
  onCancelLeave: () => void
  onRetryPost?: () => void
  onDiscard: () => Promise<void>
  onReviewLatest: () => void
  onSaveConflictDraft: () => Promise<void>
  onDiscardConflict: () => Promise<void>
}

export function CreatePostSheets({
  colors,
  saveSheetVisible,
  setSaveSheetVisible,
  draftNotice,
  setDraftNotice,
  leaveConfirmVisible,
  setLeaveConfirmVisible,
  editConflictVisible,
  setEditConflictVisible,
  isEditingPost,
  onSaveDraft,
  onDraftDone,
  onCancelLeave,
  onRetryPost,
  onDiscard,
  onReviewLatest,
  onSaveConflictDraft,
  onDiscardConflict,
}: Props) {
  const leaveActionSelected = React.useRef(false)

  return (
    <>
      <RekkusActionSheet
        visible={saveSheetVisible}
        title="Save draft"
        subtitle="Update this draft, or keep it unchanged and save a new version."
        options={[
          { label: 'Save draft', value: 'update' },
          { label: 'Save as new draft', value: 'new' },
        ]}
        onSelect={value => onSaveDraft(value as SaveDraftMode)}
        onDismiss={() => setSaveSheetVisible(false)}
      />
      <RekkusActionSheet
        visible={draftNotice != null}
        title={draftNotice?.title}
        subtitle={draftNotice?.subtitle}
        options={[
          ...(onRetryPost ? [{ label: 'Try again', value: 'try-again', accentColor: colors.accent }] : []),
          { label: 'Keep editing', value: 'keep' },
          { label: 'Done', value: 'done' },
        ]}
        onSelect={value => {
          if (value === 'try-again' && onRetryPost) onRetryPost()
          if (value === 'done') onDraftDone()
        }}
        onDismiss={() => setDraftNotice(null)}
      />
      <RekkusActionSheet
        visible={leaveConfirmVisible}
        title={isEditingPost ? 'Discard edits?' : 'Leave this post?'}
        subtitle={isEditingPost ? 'Your changes are not saved yet.' : 'Save this as a draft, or discard it before leaving.'}
        options={[
          { label: 'Keep editing', value: 'keep' },
          ...(!isEditingPost ? [{ label: 'Save draft', value: 'save', accentColor: colors.accent }] : []),
          { label: 'Discard', value: 'discard', destructive: true },
        ]}
        onSelect={async value => {
          leaveActionSelected.current = true
          if (value === 'keep') {
            onCancelLeave()
            return
          }
          if (value === 'save') {
            await onSaveDraft('update', { showConfirmation: false })
            onDraftDone()
            return
          }
          if (value === 'discard') await onDiscard()
        }}
        onDismiss={() => {
          setLeaveConfirmVisible(false)
          if (leaveActionSelected.current) {
            leaveActionSelected.current = false
            return
          }
          onCancelLeave()
        }}
      />
      <RekkusActionSheet
        visible={editConflictVisible}
        title="Review latest changes"
        subtitle="This post changed while you were editing. Your edits are still here."
        options={[
          { label: 'Review latest', value: 'latest', accentColor: colors.accent },
          { label: 'Save as draft', value: 'draft' },
          { label: 'Discard changes', value: 'discard', destructive: true },
        ]}
        onSelect={async value => {
          if (value === 'latest') onReviewLatest()
          if (value === 'draft') await onSaveConflictDraft()
          if (value === 'discard') await onDiscardConflict()
        }}
        onDismiss={() => setEditConflictVisible(false)}
      />
    </>
  )
}
