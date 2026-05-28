const assert = require('node:assert/strict')
const test = require('node:test')
const { validateAcceptanceRegister } = require('../../scripts/ops/lib/hig-acceptance')

const journeys = [
  'Onboarding',
  'Auth',
  'Feed',
  'Search',
  'Saved',
  'Create',
  'Restaurant',
  'Messaging',
  'Settings',
]

const dimensions = [
  'VoiceOver',
  'Dynamic Type',
  'Reduce Motion',
  'Reduce Transparency',
  'Dark Mode',
  'Permission Timing/Recovery',
  'Touch Target/Semantics',
]

function register(status, overrides = {}) {
  const candidate = overrides.candidate ?? 'ios-beta-42'
  const deviceType = overrides.deviceType ?? 'Physical iPhone'
  const tableRows = journeys
    .filter(journey => journey !== overrides.omitJourney)
    .map(journey => {
      const statuses = dimensions.map(dimension => {
        if (journey === overrides.cellJourney && dimension === overrides.cellDimension) {
          return overrides.cellStatus
        }
        return status
      })
      return `| ${journey} | ${statuses.join(' | ')} |`
    })
    .join('\n')

  return `# iPhone HIG Release Acceptance

## Release Candidate: \`${candidate}\`

| Field | Value |
| --- | --- |
| Environment | beta |
| App/build version | 1.0.0 (42) |
| Test date | 2026-05-27 |
| Tester | Release owner |
| Device type | ${deviceType} |
| iPhone model | iPhone 15 |
| iOS version | iOS 18.5 |
| Rollback/build reference | ios-beta-41 |

| Journey | ${dimensions.join(' | ')} |
| --- | --- | --- | --- | --- | --- | --- | --- |
${tableRows}
`
}

const backlog = ['B-240', 'B-526', 'B-528', 'B-529']
  .map(
    id =>
      `| [ ] | P1 | <a id="${id.toLowerCase()}"></a>${id} | item | why | deps | Low | Problem | Do: act | Not implemented yet. | guardrail |`
  )
  .join('\n')

test('complete blocked matrix is valid structural evidence before promotion', () => {
  const result = validateAcceptanceRegister(register('BLOCKED (B-526)'), { backlogSource: backlog })
  assert.deepEqual(result.failures, [])
})

test('promotion accepts a physical-device passing matrix for the matching candidate', () => {
  const result = validateAcceptanceRegister(register('PASS'), {
    backlogSource: backlog,
    releaseCandidate: 'ios-beta-42',
  })
  assert.deepEqual(result.failures, [])
})

test('missing journey or dimension fails structural validation', () => {
  const missingJourney = validateAcceptanceRegister(register('PASS', { omitJourney: 'Saved' }), {
    backlogSource: backlog,
  })
  const missingDimension = validateAcceptanceRegister(
    register('PASS').replace(' | Dark Mode', ''),
    { backlogSource: backlog }
  )
  assert.ok(missingJourney.failures.some(failure => failure.includes('Saved')))
  assert.ok(missingDimension.failures.some(failure => failure.includes('Dark Mode')))
})

test('missing blocker backlog reference fails validation', () => {
  const result = validateAcceptanceRegister(register('BLOCKED (B-999)'), { backlogSource: backlog })
  assert.ok(result.failures.some(failure => failure.includes('B-999')))
})

test('shipped blocker cannot remain acceptance evidence', () => {
  const shippedBacklog = backlog.replace(
    '| [ ] | P1 | <a id="b-526"></a>B-526',
    '| [x] | P1 | <a id="b-526"></a>B-526'
  )
  const result = validateAcceptanceRegister(register('BLOCKED (B-526)'), {
    backlogSource: shippedBacklog,
  })
  assert.ok(result.failures.some(failure => failure.includes('shipped blocker B-526')))
})

test('promotion rejects candidate mismatch, failures, blockers, and simulator evidence', () => {
  const mismatch = validateAcceptanceRegister(register('PASS'), {
    backlogSource: backlog,
    releaseCandidate: 'ios-beta-43',
  })
  const failed = validateAcceptanceRegister(
    register('PASS', {
      cellJourney: 'Feed',
      cellDimension: 'VoiceOver',
      cellStatus: 'FAIL',
    }),
    { backlogSource: backlog, releaseCandidate: 'ios-beta-42' }
  )
  const blocked = validateAcceptanceRegister(register('BLOCKED (B-526)'), {
    backlogSource: backlog,
    releaseCandidate: 'ios-beta-42',
  })
  const simulator = validateAcceptanceRegister(register('PASS', { deviceType: 'iOS Simulator' }), {
    backlogSource: backlog,
    releaseCandidate: 'ios-beta-42',
  })
  assert.ok(mismatch.failures.some(failure => failure.includes('ios-beta-43')))
  assert.ok(failed.failures.some(failure => failure.includes('FAIL')))
  assert.ok(blocked.failures.some(failure => failure.includes('BLOCKED')))
  assert.ok(simulator.failures.some(failure => failure.includes('Physical iPhone')))
})

test('N/A requires a stated reason', () => {
  const invalid = validateAcceptanceRegister(
    register('PASS', {
      cellJourney: 'Settings',
      cellDimension: 'Permission Timing/Recovery',
      cellStatus: 'N/A',
    }),
    { backlogSource: backlog }
  )
  const valid = validateAcceptanceRegister(
    register('PASS', {
      cellJourney: 'Settings',
      cellDimension: 'Permission Timing/Recovery',
      cellStatus: 'N/A (No permission request in this journey)',
    }),
    { backlogSource: backlog, releaseCandidate: 'ios-beta-42' }
  )
  assert.ok(invalid.failures.some(failure => failure.includes('N/A')))
  assert.deepEqual(valid.failures, [])
})
