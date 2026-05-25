"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runModerationGuardTests = runModerationGuardTests;
const moderationGuards_1 = require("../../lib/services/moderationGuards");
function runModerationGuardTests(assert) {
    assert.equal((0, moderationGuards_1.isModerationResponse)({ safe: true }), true);
    assert.equal((0, moderationGuards_1.isModerationResponse)({ safe: false, reason: 'blocked' }), true);
    assert.equal((0, moderationGuards_1.isModerationResponse)({ safe: 'yes' }), false);
    assert.equal((0, moderationGuards_1.isModerationResponse)(null), false);
}
