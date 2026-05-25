"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGooglePlacesGuardTests = runGooglePlacesGuardTests;
const googlePlacesGuards_1 = require("../../lib/services/googlePlacesGuards");
function runGooglePlacesGuardTests(assert) {
    assert.equal((0, googlePlacesGuards_1.hasAllowedGoogleStatus)({ status: 'OK' }), true);
    assert.equal((0, googlePlacesGuards_1.hasAllowedGoogleStatus)({ status: 'ZERO_RESULTS' }), true);
    assert.equal((0, googlePlacesGuards_1.hasAllowedGoogleStatus)({ status: 'REQUEST_DENIED' }), false);
    assert.equal((0, googlePlacesGuards_1.hasAllowedGoogleStatus)(null), false);
    assert.deepEqual((0, googlePlacesGuards_1.googlePredictionsEnvelope)({ predictions: [1, 2] }), { predictions: [1, 2] });
    assert.deepEqual((0, googlePlacesGuards_1.googlePredictionsEnvelope)({ predictions: 'bad' }), { predictions: [] });
    assert.equal((0, googlePlacesGuards_1.googlePredictionsEnvelope)(null), null);
    const isItem = (value) => typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string';
    assert.deepEqual((0, googlePlacesGuards_1.googleResultEnvelope)({ result: { id: 'p1' } }, isItem), { result: { id: 'p1' } });
    assert.deepEqual((0, googlePlacesGuards_1.googleResultEnvelope)({ result: { id: 1 } }, isItem), {});
    assert.deepEqual((0, googlePlacesGuards_1.googleResultsEnvelope)({ results: [{ id: 'p1' }, { id: 1 }] }, isItem), { results: [{ id: 'p1' }] });
    assert.equal((0, googlePlacesGuards_1.isGoogleAreaSuggestion)({
        place_id: 'abc',
        description: 'Sydney NSW',
        structured_formatting: { main_text: 'Sydney', secondary_text: 'NSW' },
    }), true);
    assert.equal((0, googlePlacesGuards_1.isGoogleAreaSuggestion)({ place_id: 'abc' }), false);
}
