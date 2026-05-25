import assert from 'node:assert/strict'
import test from 'node:test'
import { runEdgeFunctionGuardTests } from './edgeFunctionGuards.test'
import { runGooglePlacesGuardTests } from './googlePlacesGuards.test'
import { runModerationGuardTests } from './moderationGuards.test'
import { runRouteParamsTests } from './routeParams.test'
import { runRuntimeBoundaryGuardTests } from './runtimeBoundaryGuards.test'
import { runSafeJsonTests } from './safeJson.test'

test('safe JSON guards', () => runSafeJsonTests(assert))
test('route param guards', () => runRouteParamsTests(assert))
test('Google Places guards', () => runGooglePlacesGuardTests(assert))
test('moderation guards', () => runModerationGuardTests(assert))
test('Edge Function guards', () => runEdgeFunctionGuardTests(assert))
test('runtime boundary guards', () => runRuntimeBoundaryGuardTests(assert))
