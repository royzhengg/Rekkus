import { Platform } from 'react-native'

export type GifResult = {
  id: string
  title: string
  url: string
  previewUrl: string
  width: number
  height: number
}

const GIPHY_BASE_URL = 'https://api.giphy.com/v1/gifs'

function getGiphyApiKey(): string {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_GIPHY_IOS_API_KEY
      ?? process.env.EXPO_PUBLIC_GIPHY_API_KEY
      ?? ''
  }
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_GIPHY_ANDROID_API_KEY
      ?? process.env.EXPO_PUBLIC_GIPHY_API_KEY
      ?? ''
  }
  return process.env.EXPO_PUBLIC_GIPHY_API_KEY
    ?? process.env.EXPO_PUBLIC_GIPHY_IOS_API_KEY
    ?? process.env.EXPO_PUBLIC_GIPHY_ANDROID_API_KEY
    ?? ''
}

export function hasGifProvider(): boolean {
  return getGiphyApiKey().trim().length > 0
}

function mapGiphyResult(row: any): GifResult | null {
  const images = row?.images ?? {}
  const sendImage = images.original ?? images.downsized ?? images.fixed_height
  const previewImage = images.fixed_width_small ?? images.preview_gif ?? images.downsized_still ?? sendImage
  const url = sendImage?.url
  const previewUrl = previewImage?.url
  if (!row?.id || !url || !previewUrl) return null

  return {
    id: String(row.id),
    title: row.title || 'GIF',
    url,
    previewUrl,
    width: Number(sendImage?.width ?? 320),
    height: Number(sendImage?.height ?? 240),
  }
}

export async function fetchGifs(query?: string): Promise<{ gifs: GifResult[]; error: string | null }> {
  if (!hasGifProvider()) {
    return { gifs: [], error: 'Add EXPO_PUBLIC_GIPHY_IOS_API_KEY or EXPO_PUBLIC_GIPHY_ANDROID_API_KEY to enable GIF search.' }
  }
  const apiKey = getGiphyApiKey()

  const params = new URLSearchParams({
    api_key: apiKey,
    limit: '24',
    rating: 'pg-13',
  })

  const trimmed = query?.trim()
  const path = trimmed ? 'search' : 'trending'
  if (trimmed) params.set('q', trimmed)

  try {
    const response = await fetch(`${GIPHY_BASE_URL}/${path}?${params.toString()}`)
    if (!response.ok) {
      return { gifs: [], error: 'GIFs could not be loaded right now.' }
    }
    const json = await response.json()
    const gifs = (json?.data ?? []).map(mapGiphyResult).filter(Boolean) as GifResult[]
    return { gifs, error: null }
  } catch {
    return { gifs: [], error: 'GIFs could not be loaded right now.' }
  }
}
