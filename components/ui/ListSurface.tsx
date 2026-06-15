import { FlashList, type FlashListProps } from '@shopify/flash-list'

type Props<ItemT> = FlashListProps<ItemT> & {
  quietScrollIndicator?: boolean
}

export function ListSurface<ItemT>({
  quietScrollIndicator = true,
  showsVerticalScrollIndicator,
  ...props
}: Props<ItemT>) {
  return (
    <FlashList
      showsVerticalScrollIndicator={showsVerticalScrollIndicator ?? !quietScrollIndicator}
      {...props}
    />
  )
}
