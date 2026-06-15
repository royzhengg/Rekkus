import {
  isGooglePlaceDetail,
  isGooglePlaceMetadata,
  isGooglePrediction,
  isGoogleTextSearchPlace,
} from '../../lib/services/googlePlacesGuards'
import { parseDirectMessage, parseDirectMessageList, parseMessageReaction } from '../../lib/services/messaging/guards'
import { isLocalDraftList, isRemoteDraftRow } from '../../lib/services/postDrafts/guards'
import { isCachedPostList, isRawPost } from '../../lib/services/posts/guards'
import { isPostUploadJobList } from '../../lib/services/postUploadGuards'
import { parsePlaceResults, parseSearchSuggestions } from '../../lib/services/searchGuards'
import type { StrictAssert } from './assert'

export function runRuntimeBoundaryGuardTests(assert: StrictAssert) {
  const place = {
    name: 'Noodles',
    formatted_address: '1 High St',
    geometry: { location: { lat: -33, lng: 151 } },
  }
  assert.equal(isGooglePlaceDetail(place), true)
  assert.equal(isGooglePlaceDetail({ name: 'Noodles' }), false)
  assert.equal(isGooglePlaceMetadata({ rating: 4.5, photos: [{ photo_reference: 'p1' }] }), true)
  assert.equal(isGooglePrediction({
    place_id: 'p1',
    description: 'Noodles',
    structured_formatting: { main_text: 'Noodles', secondary_text: 'Sydney' },
    types: ['restaurant'],
  }), true)
  assert.equal(isGoogleTextSearchPlace({ ...place, place_id: 'p1' }), true)

  const message = {
    id: 'm1', conversation_id: 'c1', sender_id: 'u1', body: 'hi', message_type: 'text',
    attachment_url: null, attachment_metadata: { shared: true }, reply_to_message_id: null,
    created_at: 'now', deleted_at: null,
  }
  assert.deepEqual(parseDirectMessage(message), message)
  assert.equal(parseDirectMessage({ ...message, message_type: 'bad' }), null)
  assert.equal(parseDirectMessageList([message, { nope: true }]).length, 1)
  assert.equal(parseMessageReaction({ id: 'r1', message_id: 'm1', user_id: 'u1', emoji: '+', created_at: 'now' })?.id, 'r1')

  assert.deepEqual(parsePlaceResults([{
    id: 'r1', name: 'Noodles', address: null, city: null, cuisine_type: null,
    google_place_id: null, latitude: null, longitude: null, google_rating: null, google_review_count: null,
  }, { id: 2 }]).length, 1)
  assert.deepEqual(parseSearchSuggestions([{
    suggestion_type: 'dish', display_text: 'ramen', secondary_text: '', entity_id: null, score: 2,
  }, { suggestion_type: 'bad' }]).length, 1)

  const cachedPost = {
    id: 1, dbId: 'p1', title: '', body: '', creator: 'u', initials: 'U', avatarBg: 'x',
    avatarColor: 'y', likes: '0', imgKey: 'warm', tall: false, tags: [], location: '',
    food: 0, vibe: 0, cost: 0,
  }
  assert.equal(isCachedPostList([cachedPost]), true)
  assert.equal(isCachedPostList([{ ...cachedPost, food: 'bad' }]), false)
  assert.equal(isRawPost(null), false)
  const rawPost = {
    id: 'p1', user_id: 'u1', caption: null, food_rating: null, vibe_rating: null,
    cost_rating: null, cuisine_type: null, must_order: null, place_id: null,
    taste_verdict: null, value_verdict: null, occasion_tags: null, created_at: null,
    last_edited_at: null, edit_count: null, users: null, places: null, post_photos: [],
  }
  assert.equal(isRawPost(rawPost), true)
  assert.equal(isRawPost({
    ...rawPost,
    post_photos: [{
      id: 'media', url: 'https://example.com/m', deleted_at: null, media_type: 'animation',
      processed_url: null, thumbnail_url: null, mime_type: null, duration_ms: null,
      width: null, height: null, size_bytes: null, processing_status: null,
      processing_error: null, order_index: 0,
    }],
  }), false)

  assert.equal(isPostUploadJobList([{ id: 'j', title: 'post', progress: 1, status: 'failed' }]), true)
  assert.equal(isPostUploadJobList([{ id: 'j', title: 'post', progress: 1, status: 'unknown' }]), false)

  const localDraft = {
    media: [], title: '', selectedPlace: null, dishTags: [], foodRating: 0, vibeRating: 0,
    costRating: 0, body: '', mustOrder: '', cuisineType: '', hashtags: [], hashtagInput: '', updatedAt: 'now',
  }
  assert.equal(isLocalDraftList([localDraft]), true)
  assert.equal(isLocalDraftList([{ ...localDraft, media: [{ type: 'bad' }] }]), false)
  assert.equal(isRemoteDraftRow({}), false)
}
