"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSafeJsonTests = runSafeJsonTests;
const safeJson_1 = require("../../lib/utils/safeJson");
function runSafeJsonTests(assert) {
    assert.deepEqual((0, safeJson_1.parseJsonWithGuard)('["a","b"]', safeJson_1.isStringArray), ['a', 'b']);
    assert.equal((0, safeJson_1.parseJsonWithGuard)('["a",1]', safeJson_1.isStringArray), null);
    assert.equal((0, safeJson_1.parseJsonWithGuard)('{bad json', safeJson_1.isRecord), null);
    assert.deepEqual((0, safeJson_1.parseJsonWithGuard)('{"ok":true}', safeJson_1.isRecord), { ok: true });
}
