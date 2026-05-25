import { routeParamNumber, routeParamString, routeParamsObject } from '../../lib/utils/routeParams'
import type { StrictAssert } from './assert'

export function runRouteParamsTests(assert: StrictAssert) {
  assert.equal(routeParamString('abc'), 'abc')
  assert.equal(routeParamString(['first', 'second']), 'first')
  assert.equal(routeParamString(undefined), undefined)
  assert.equal(routeParamNumber('12.5'), 12.5)
  assert.equal(routeParamNumber('nope'), null)
  assert.equal(routeParamNumber(undefined), null)
  assert.deepEqual(routeParamsObject({ a: 'x', b: ['y'], c: undefined }, ['a', 'b', 'c']), {
    a: 'x',
    b: 'y',
  })
}
