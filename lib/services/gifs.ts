import { Platform } from 'react-native'
import { GIPHY_ANDROID_API_KEY, GIPHY_API_KEY, GIPHY_IOS_API_KEY } from '@/lib/config'
import { reportInvalidBoundary } from './boundaryTelemetry'

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
    return GIPHY_IOS_API_KEY || GIPHY_API_KEY
  }
  if (Platform.OS === 'android') {
    return GIPHY_ANDROID_API_KEY || GIPHY_API_KEY
  }
  return GIPHY_API_KEY || GIPHY_IOS_API_KEY || GIPHY_ANDROID_API_KEY
}

export function hasGifProvider(): boolean {
  return getGiphyApiKey().trim().length > 0
}

type GiphyImageVariant = { url?: string; width?: string; height?: string }
type GiphyApiRow = {
  id?: unknown
  title?: unknown
  images?: {
    original?: GiphyImageVariant
    downsized?: GiphyImageVariant
    fixed_height?: GiphyImageVariant
    fixed_width_small?: GiphyImageVariant
    preview_gif?: GiphyImageVariant
    downsized_still?: GiphyImageVariant
  }
}

function isGiphyVariant(value: unknown): value is GiphyImageVariant {
  return typeof value === 'object' && value !== null
}

function isGiphyApiRow(value: unknown): value is GiphyApiRow {
  if (typeof value !== 'object' || value === null || !('images' in value)) return false
  const images = value.images
  if (typeof images !== 'object' || images === null) return false
  return Object.values(images).every(image => image === undefined || isGiphyVariant(image))
}

function mapGiphyResult(row: GiphyApiRow): GifResult | null {
  const images = row?.images ?? {}
  const sendImage = images.original ?? images.downsized ?? images.fixed_height
  const previewImage = images.fixed_width_small ?? images.preview_gif ?? images.downsized_still ?? sendImage
  const url = sendImage?.url
  const previewUrl = previewImage?.url
  if (!row?.id || !url || !previewUrl) return null

  return {
    id: String(row.id),
    title: String(row.title || 'GIF'),
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
    const json: unknown = await response.json()
    const data = typeof json === 'object' && json !== null && 'data' in json ? json.data : []
    const rows = Array.isArray(data) ? data : []
    const gifs = rows
      .filter(isGiphyApiRow)
      .map(row => mapGiphyResult(row))
      .filter((gif): gif is GifResult => gif !== null)
    if (!Array.isArray(data) || gifs.length !== rows.length) {
      reportInvalidBoundary('giphy_item_invalid')
    }
    return { gifs, error: null }
  } catch {
    return { gifs: [], error: 'GIFs could not be loaded right now.' }
  }
}
