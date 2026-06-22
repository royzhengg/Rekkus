import { supabase } from '@/lib/supabase'
import { getPlaceProviderPhotoUrl } from './google'

export async function getPlaceDisplayPhotos(
  placeId?: string | null,
  providerPhotoRefs: string[] = [],
  maxPhotos = 6
): Promise<string[]> {
  const providerUrls = providerPhotoRefs
    .slice(0, maxPhotos)
    .map(ref => getPlaceProviderPhotoUrl(ref))
    .filter(Boolean)

  if (!placeId) return providerUrls

  const { data } = await supabase.from('posts')
    .select('post_photos ( url, order_index )')
    .eq('place_id', placeId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(24)

  const firstPartyUrls = (data ?? [])
    .flatMap((row) => row.post_photos ?? [])
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map(photo => photo.url)
    .filter((url, index, arr): url is string => typeof url === 'string' && !!url && arr.indexOf(url) === index)
    .slice(0, maxPhotos)

  return firstPartyUrls.length > 0 ? firstPartyUrls : providerUrls
}

export async function getPlaceDisplayPhoto(
  placeId?: string | null,
  providerPhotoRefs: string[] = []
): Promise<string | null> {
  const photos = await getPlaceDisplayPhotos(placeId, providerPhotoRefs, 1)
  return photos[0] ?? null
}

export async function cachePlacePhotoRefs(placeId: string, googlePhotoRefs: string[]): Promise<void> {
  if (googlePhotoRefs.length === 0) return
  await supabase.from('places')
    .update({ google_photo_refs: googlePhotoRefs })
    .eq('id', placeId)
}
