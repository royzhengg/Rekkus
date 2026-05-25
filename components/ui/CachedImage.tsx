import { Image, type ImageContentFit, type ImageSource } from 'expo-image'
import { useReducedMotion } from '@/lib/hooks/useReducedMotion'
import type { StyleProp, ImageStyle } from 'react-native'

type Props = {
  source: ImageSource | string | number | null | undefined
  style?: StyleProp<ImageStyle>
  contentFit?: ImageContentFit
  accessibilityLabel?: string
}

export function CachedImage({
  source,
  style,
  contentFit = 'cover',
  accessibilityLabel,
}: Props) {
  const reduceMotion = useReducedMotion()

  if (!source) return null

  return (
    <Image
      source={source}
      style={style}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      transition={reduceMotion ? 0 : 120}
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
    />
  )
}
