import { CollectionPickerSheet } from '@/components/CollectionPickerSheet'
import { RekkusActionSheet } from '@/components/ui/RekkusActionSheet'
import type { Collection } from '@/lib/services/collections'

type Props = {
  pickerVisible: boolean
  confirmUnsaveVisible: boolean
  targetLabel: string
  collections: Collection[]
  loading?: boolean
  onDismissPicker: () => void
  onSelectCollection: (collectionId: string) => void
  onCreateCollection: (name: string) => void
  onDismissConfirmUnsave: () => void
  onConfirmUnsave: () => void
}

export function SavedTargetCollectionSheets({
  pickerVisible,
  confirmUnsaveVisible,
  targetLabel,
  collections,
  loading = false,
  onDismissPicker,
  onSelectCollection,
  onCreateCollection,
  onDismissConfirmUnsave,
  onConfirmUnsave,
}: Props) {
  return (
    <>
      <CollectionPickerSheet
        visible={pickerVisible}
        collections={collections}
        loading={loading}
        onDismiss={onDismissPicker}
        onSelect={onSelectCollection}
        onCreate={onCreateCollection}
      />
      <RekkusActionSheet
        visible={confirmUnsaveVisible}
        title={`Remove saved ${targetLabel}?`}
        subtitle={`This ${targetLabel} is in a collection. Removing it also removes it from your collections.`}
        options={[
          { label: 'Keep saved', value: 'keep' },
          { label: 'Remove everywhere', value: 'remove', destructive: true },
        ]}
        onSelect={value => {
          if (value === 'remove') onConfirmUnsave()
        }}
        onDismiss={onDismissConfirmUnsave}
      />
    </>
  )
}
