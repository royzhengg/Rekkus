const test = require('node:test')
const assert = require('node:assert/strict')
const { canonicalRegistryFailures } = require('../../scripts/lib/canonical-registry-rules')

const table = rows => [
  '## Canonical Patterns',
  '',
  '| Pattern | Canonical | State | Decision |',
  '| --- | --- | --- | --- |',
  ...rows,
].join('\n')

const accepted = '# ADR 0005\n\nStatus: Accepted\n'

test('canonical registry rejects active rows without accepted ADRs', () => {
  assert.deepEqual(
    canonicalRegistryFailures(table(['| Loading | `<Skeleton>` | Stable | |']), () => accepted),
    ['Canonical pattern "Loading" must link exactly one ADR decision.'],
  )
  assert.deepEqual(
    canonicalRegistryFailures(table(['| Loading | `<Skeleton>` | Stable | [ADR](docs/adr/missing.md) |']), () => null),
    ['Canonical pattern "Loading" links to missing ADR: docs/adr/missing.md.'],
  )
  assert.deepEqual(
    canonicalRegistryFailures(table(['| Loading | `<Skeleton>` | Stable | [ADR](docs/adr/draft.md) |']), () => 'Status: Proposed'),
    ['Canonical pattern "Loading" must link to an Accepted ADR: docs/adr/draft.md.'],
  )
})

test('canonical registry allows related active rows to share one accepted ADR', () => {
  const source = table([
    '| Loading action | `ActivityIndicator` | Stable | [ADR 0005](docs/adr/0005-loading.md) |',
    '| Loading content | `<Skeleton>` | Stable | [ADR 0005](docs/adr/0005-loading.md) |',
  ])
  assert.deepEqual(canonicalRegistryFailures(source, () => accepted), [])
})
