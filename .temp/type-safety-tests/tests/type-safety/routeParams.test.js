"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRouteParamsTests = runRouteParamsTests;
const routeParams_1 = require("../../lib/utils/routeParams");
function runRouteParamsTests(assert) {
    assert.equal((0, routeParams_1.routeParamString)('abc'), 'abc');
    assert.equal((0, routeParams_1.routeParamString)(['first', 'second']), 'first');
    assert.equal((0, routeParams_1.routeParamString)(undefined), undefined);
    assert.equal((0, routeParams_1.routeParamNumber)('12.5'), 12.5);
    assert.equal((0, routeParams_1.routeParamNumber)('nope'), null);
    assert.equal((0, routeParams_1.routeParamNumber)(undefined), null);
    assert.deepEqual((0, routeParams_1.routeParamsObject)({ a: 'x', b: ['y'], c: undefined }, ['a', 'b', 'c']), {
        a: 'x',
        b: 'y',
    });
}
