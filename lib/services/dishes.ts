import { supabase } from '@/lib/supabase'
import { isRecord } from '@/lib/utils/safeJson'
import type { DishDetail, SavedDish } from '@/types/domain'

type DishPlaceRow = {
  id: string
  name: string
  address: string | null
  google_place_id: string | null
  latitude: number | null
  longitude: number | null
}

type DishRow = {
  id: string
  name: string
  cuisine_type: string | null
  place_id: string | null
  places: DishPlaceRow | null
}

function parsePlace(value: unknown): DishPlaceRow | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return null
  return {
    id: value.id,
    name: value.name,
    address: typeof value.address === 'string' ? value.address : null,
    google_place_id: typeof value.google_place_id === 'string' ? value.google_place_id : null,
    latitude: typeof value.latitude === 'number' ? value.latitude : null,
    longitude: typeof value.longitude === 'number' ? value.longitude : null,
  }
}

function parseDishRow(value: unknown): DishRow | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return null
  return {
    id: value.id,
    name: value.name,
    cuisine_type: typeof value.cuisine_type === 'string' ? value.cuisine_type : null,
    place_id: typeof value.place_id === 'string' ? value.place_id : null,
    places: parsePlace(value.places),
  }
}

export function mapRowToDish(row: DishRow): DishDetail {
  return normalizeDish(row)
}

function normalizeDish(row: DishRow): DishDetail {
  const place = row.places
  return {
    id: row.id,
    name: row.name,
    ...(row.place_id ? { placeId: row.place_id } : {}),
    ...(row.cuisine_type ? { cuisineType: row.cuisine_type } : {}),
    ...(place ? {
      place: {
        id: place.id,
        name: place.name,
        ...(place.address ? { address: place.address } : {}),
        ...(place.google_place_id ? { googlePlaceId: place.google_place_id } : {}),
        ...(place.latitude != null ? { lat: place.latitude } : {}),
        ...(place.longitude != null ? { lng: place.longitude } : {}),
      },
    } : {}),
  }
}

export async function findOrCreateDish(params: {
  name: string
  placeId: string
  cuisineType?: string | null
  userId?: string
  context?: Record<string, string>
}): Promise<string> {
  const { data, error } = await supabase.rpc('find_or_create_dish', {
    p_name:          params.name.trim(),
    p_place_id:      params.placeId,
    p_context:       params.context ?? null,
    ...(params.cuisineType != null ? { p_cuisine_type: params.cuisineType } : {}),
    ...(params.userId != null ? { p_created_by: params.userId } : {}),
  })
  if (error) throw error
  return data
}

const DISH_SELECT = `
  id, name, cuisine_type, place_id,
  places ( id, name, address, google_place_id, latitude, longitude )
`.trim()

export async function fetchDishDetail(dishId: string): Promise<DishDetail | null> {
  const { data, error } = await supabase.from('dishes')
    .select(DISH_SELECT)
    .eq('id', dishId)
    .maybeSingle()
    .overrideTypes<unknown, { merge: false }>()
  if (error) throw error
  const row = parseDishRow(data)
  return row ? normalizeDish(row) : null
}

export async function fetchDishesByIds(dishIds: string[]): Promise<DishDetail[]> {
  if (dishIds.length === 0) return []
  const { data, error } = await supabase.from('dishes')
    .select(DISH_SELECT)
    .in('id', dishIds)
    .limit(Math.min(dishIds.length, 100))
    .overrideTypes<unknown[], { merge: false }>()
  if (error) throw error
  return (data ?? []).flatMap(value => {
    const row = parseDishRow(value)
    return row ? [normalizeDish(row)] : []
  })
}

export async function fetchIsDishSaved(userId: string, dishId: string): Promise<boolean> {
  const { data, error } = await supabase.from('saved_dishes')
    .select('id')
    .eq('user_id', userId)
    .eq('dish_id', dishId)
    .maybeSingle()
  if (error) throw error
  return data !== null
}

export async function saveDish(userId: string, dishId: string): Promise<void> {
  const { error } = await supabase.from('saved_dishes').upsert(
    { user_id: userId, dish_id: dishId },
    { onConflict: 'user_id,dish_id' }
  )
  if (error) throw error
}

export async function fetchSavedDishes(userId: string): Promise<SavedDish[]> {
  const { data, error } = await supabase.from('saved_dishes')
    .select(`created_at, dishes ( ${DISH_SELECT} )`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
    .overrideTypes<Array<{ created_at: string; dishes: unknown }>, { merge: false }>()
  if (error) throw error

  const savedDishes = (data ?? []).flatMap(saved => {
    const row = parseDishRow(saved.dishes)
    return row ? [{ ...normalizeDish(row), savedAt: saved.created_at }] : []
  })
  const dishIds = savedDishes.map(dish => dish.id)
  if (dishIds.length === 0) return savedDishes

  const { data: postRows, error: postsError } = await supabase.from('posts')
    .select('dish_id, post_photos ( processed_url, url, order_index )')
    .in('dish_id', dishIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)
    .overrideTypes<unknown[], { merge: false }>()
  if (postsError) throw postsError

  const imageByDishId = new Map<string, string>()
  for (const value of postRows ?? []) {
    if (!isRecord(value) || typeof value.dish_id !== 'string' || imageByDishId.has(value.dish_id)) continue
    const photos = Array.isArray(value.post_photos) ? value.post_photos : []
    const firstPhoto = photos
      .filter(isRecord)
      .sort((left, right) => {
        const leftIndex = typeof left.order_index === 'number' ? left.order_index : 0
        const rightIndex = typeof right.order_index === 'number' ? right.order_index : 0
        return leftIndex - rightIndex
      })
      .find(photo => typeof photo.processed_url === 'string' || typeof photo.url === 'string')
    if (!firstPhoto) continue
    const url = typeof firstPhoto.processed_url === 'string' ? firstPhoto.processed_url : firstPhoto.url
    if (typeof url === 'string') imageByDishId.set(value.dish_id, url)
  }

  return savedDishes.map(dish => ({
    ...dish,
    ...(imageByDishId.get(dish.id) ? { representativeImageUrl: imageByDishId.get(dish.id) } : {}),
  }))
}
