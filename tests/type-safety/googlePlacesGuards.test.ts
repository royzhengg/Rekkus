import {
  googlePredictionsEnvelope,
  googleResultEnvelope,
  googleResultsEnvelope,
  hasAllowedGoogleStatus,
  isGoogleAreaSuggestion,
} from '../../lib/services/googlePlacesGuards'
import type { StrictAssert } from './assert'

export function runGooglePlacesGuardTests(assert: StrictAssert) {
  assert.equal(hasAllowedGoogleStatus({ status: 'OK' }), true)
  assert.equal(hasAllowedGoogleStatus({ status: 'ZERO_RESULTS' }), true)
  assert.equal(hasAllowedGoogleStatus({ status: 'REQUEST_DENIED' }), false)
  assert.equal(hasAllowedGoogleStatus(null), false)

  assert.deepEqual(googlePredictionsEnvelope({ predictions: [1, 2] }), { predictions: [1, 2] })
  assert.deepEqual(googlePredictionsEnvelope({ predictions: 'bad' }), { predictions: [] })
  assert.equal(googlePredictionsEnvelope(null), null)

  const isItem = (value: unknown): value is { id: string } =>
    typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string'
  assert.deepEqual(googleResultEnvelope({ result: { id: 'p1' } }, isItem), { result: { id: 'p1' } })
  assert.deepEqual(googleResultEnvelope({ result: { id: 1 } }, isItem), {})
  assert.deepEqual(googleResultsEnvelope({ results: [{ id: 'p1' }, { id: 1 }] }, isItem), { results: [{ id: 'p1' }] })

  assert.equal(isGoogleAreaSuggestion({
    place_id: 'abc',
    description: 'Sydney NSW',
    structured_formatting: { main_text: 'Sydney', secondary_text: 'NSW' },
  }), true)
  assert.equal(isGoogleAreaSuggestion({ place_id: 'abc' }), false)
}
