"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRuntimeBoundaryGuardTests = runRuntimeBoundaryGuardTests;
const googlePlacesGuards_1 = require("../../lib/services/googlePlacesGuards");
const guards_1 = require("../../lib/services/messaging/guards");
const guards_2 = require("../../lib/services/postDrafts/guards");
const guards_3 = require("../../lib/services/posts/guards");
const postUploadGuards_1 = require("../../lib/services/postUploadGuards");
const searchGuards_1 = require("../../lib/services/searchGuards");
function runRuntimeBoundaryGuardTests(assert) {
    const place = {
        name: 'Noodles',
        formatted_address: '1 High St',
        geometry: { location: { lat: -33, lng: 151 } },
    };
    assert.equal((0, googlePlacesGuards_1.isGooglePlaceDetail)(place), true);
    assert.equal((0, googlePlacesGuards_1.isGooglePlaceDetail)({ name: 'Noodles' }), false);
    assert.equal((0, googlePlacesGuards_1.isGooglePlaceMetadata)({ rating: 4.5, photos: [{ photo_reference: 'p1' }] }), true);
    assert.equal((0, googlePlacesGuards_1.isGooglePrediction)({
        place_id: 'p1',
        description: 'Noodles',
        structured_formatting: { main_text: 'Noodles', secondary_text: 'Sydney' },
        types: ['restaurant'],
    }), true);
    assert.equal((0, googlePlacesGuards_1.isGoogleTextSearchPlace)({ ...place, place_id: 'p1' }), true);
    const message = {
        id: 'm1', conversation_id: 'c1', sender_id: 'u1', body: 'hi', message_type: 'text',
        attachment_url: null, attachment_metadata: { shared: true }, reply_to_message_id: null,
        created_at: 'now', deleted_at: null,
    };
    assert.deepEqual((0, guards_1.parseDirectMessage)(message), message);
    assert.equal((0, guards_1.parseDirectMessage)({ ...message, message_type: 'bad' }), null);
    assert.equal((0, guards_1.parseDirectMessageList)([message, { nope: true }]).length, 1);
    assert.equal((0, guards_1.parseMessageReaction)({ id: 'r1', message_id: 'm1', user_id: 'u1', emoji: '+', created_at: 'now' })?.id, 'r1');
    assert.deepEqual((0, searchGuards_1.parsePlaceResults)([{
            id: 'r1', name: 'Noodles', address: null, city: null, cuisine_type: null,
            google_place_id: null, latitude: null, longitude: null, google_rating: null, google_review_count: null,
        }, { id: 2 }]).length, 1);
    assert.deepEqual((0, searchGuards_1.parseSearchSuggestions)([{
            suggestion_type: 'dish', display_text: 'ramen', secondary_text: '', entity_id: null, score: 2,
        }, { suggestion_type: 'bad' }]).length, 1);
    const cachedPost = {
        id: 1, dbId: 'p1', title: '', body: '', creator: 'u', initials: 'U', avatarBg: 'x',
        avatarColor: 'y', likes: '0', imgKey: 'warm', tall: false, tags: [], location: '',
        food: 0, vibe: 0, cost: 0,
    };
    assert.equal((0, guards_3.isCachedPostList)([cachedPost]), true);
    assert.equal((0, guards_3.isCachedPostList)([{ ...cachedPost, food: 'bad' }]), false);
    assert.equal((0, guards_3.isRawPost)(null), false);
    const rawPost = {
        id: 'p1', user_id: 'u1', caption: null, food_rating: null, vibe_rating: null,
        cost_rating: null, cuisine_type: null, best_dish: null, restaurant_id: null,
        taste_verdict: null, value_verdict: null, occasion_tags: null, created_at: null,
        last_edited_at: null, edit_count: null, users: null, restaurants: null, post_photos: [],
    };
    assert.equal((0, guards_3.isRawPost)(rawPost), true);
    assert.equal((0, guards_3.isRawPost)({
        ...rawPost,
        post_photos: [{
                id: 'media', url: 'https://example.com/m', deleted_at: null, media_type: 'animation',
                processed_url: null, thumbnail_url: null, mime_type: null, duration_ms: null,
                width: null, height: null, size_bytes: null, processing_status: null,
                processing_error: null, order_index: 0,
            }],
    }), false);
    assert.equal((0, postUploadGuards_1.isPostUploadJobList)([{ id: 'j', title: 'post', progress: 1, status: 'failed' }]), true);
    assert.equal((0, postUploadGuards_1.isPostUploadJobList)([{ id: 'j', title: 'post', progress: 1, status: 'unknown' }]), false);
    const localDraft = {
        media: [], title: '', selectedPlace: null, dishTags: [], foodRating: 0, vibeRating: 0,
        costRating: 0, body: '', bestDish: '', cuisineType: '', hashtags: [], hashtagInput: '', updatedAt: 'now',
    };
    assert.equal((0, guards_2.isLocalDraftList)([localDraft]), true);
    assert.equal((0, guards_2.isLocalDraftList)([{ ...localDraft, media: [{ type: 'bad' }] }]), false);
    assert.equal((0, guards_2.isRemoteDraftRow)({}), false);
}
