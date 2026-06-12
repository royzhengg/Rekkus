// Tests for the three highest-risk extracted check functions from check-operations.js.
// These guard against regressions when the modules are modified.

jest.mock('../../../../scripts/ops/lib/backlog', () => ({
  BACKLOG_HEADER: '| Status | Priority | ID | Item | Problem | Implementations | Implementation Type |',
  duplicateBacklogIds: jest.fn((rows: unknown[]) => {
    const seen = new Set<string>()
    const dupes: string[] = []
    for (const row of rows as Array<{ id: string }>) {
      if (seen.has(row.id)) dupes.push(row.id)
      seen.add(row.id)
    }
    return dupes
  }),
  hasExpectedBacklogSchema: jest.fn(() => true),
}))

jest.mock('../../../../scripts/ops/lib/feature-flags', () => ({
  parseFeatureFlags: jest.fn(() => []),
  referencesForFlag: jest.fn(() => ['lib/featureFlags.ts', 'features/auth/SomeScreen.tsx']),
}))

const { checkBacklog, checkBacklogSpecificity, checkBacklogEvidence, checkBacklogStructure, checkCompletedItemsOrder } = require('../../../../scripts/ops/checks/backlog') as {
  checkBacklog: (rows: unknown[], result: { failures: string[]; warnings: string[] }) => void
  checkBacklogSpecificity: (rows: unknown[], result: { failures: string[]; warnings: string[] }) => void
  checkBacklogEvidence: (
    backlogById: Map<string, unknown>,
    result: { failures: string[]; warnings: string[] },
    options?: { evidenceRules?: Map<string, string[]>; existsFn?: (f: string) => boolean }
  ) => { verified: string[]; docsOnly: string[]; missingEvidence: Array<{ id: string; missing: string[] }>; needsImplementation: string[] }
  checkBacklogStructure: (content: string, result: { failures: string[]; warnings: string[] }) => void
  checkCompletedItemsOrder: (content: string, result: { failures: string[]; warnings: string[] }) => void
}

const { checkFeatureFlags } = require('../../../../scripts/ops/checks/feature-flags') as {
  checkFeatureFlags: (
    flags: unknown[],
    today: string,
    result: { failures: string[]; warnings: string[] }
  ) => { count: number; stale: string[]; unreferenced: string[] }
}

function makeResult() {
  return { failures: [] as string[], warnings: [] as string[] }
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'B-001',
    line: 'id="b-001"',
    cellCount: 7,
    status: '[ ]',
    priority: 'P2',
    item: 'Add some feature',
    problem: 'Users cannot do X. Do: implement X.',
    implementation: 'Not implemented yet.',
    implementationType: 'runtime-feature',
    ...overrides,
  }
}

// ── checkBacklog ──────────────────────────────────────────────────────────────

describe('checkBacklog', () => {
  it('produces no failures for a valid row', () => {
    const result = makeResult()
    checkBacklog([makeRow()], result)
    expect(result.failures).toHaveLength(0)
  })

  it('fails when an ID has invalid format', () => {
    const result = makeResult()
    checkBacklog([makeRow({ id: 'INVALID', line: 'id="b-invalid"' })], result)
    expect(result.failures.some((f) => f.includes('invalid ID format'))).toBe(true)
  })

  it('fails when IDs are out of order', () => {
    const result = makeResult()
    const rows = [
      makeRow({ id: 'B-002', line: 'id="b-2"' }),
      makeRow({ id: 'B-001', line: 'id="b-1"' }),
    ]
    checkBacklog(rows, result)
    expect(result.failures.some((f) => f.includes('out of order'))).toBe(true)
  })

  it('fails when a row has wrong cell count', () => {
    const result = makeResult()
    checkBacklog([makeRow({ cellCount: 8 })], result)
    expect(result.failures.some((f) => f.includes('7 table cells'))).toBe(true)
  })

  it('fails when status is invalid', () => {
    const result = makeResult()
    checkBacklog([makeRow({ status: '[y]' })], result)
    expect(result.failures.some((f) => f.includes('invalid status'))).toBe(true)
  })

  it('fails when problem statement is missing', () => {
    const result = makeResult()
    checkBacklog([makeRow({ problem: '' })], result)
    expect(result.failures.some((f) => f.includes('missing a Problem statement'))).toBe(true)
  })

  it('fails when implementation note is missing', () => {
    const result = makeResult()
    checkBacklog([makeRow({ implementation: '' })], result)
    expect(result.failures.some((f) => f.includes('missing an Implementations note'))).toBe(true)
  })

  it('fails when shipped with implementationType none', () => {
    const result = makeResult()
    checkBacklog([makeRow({ status: '[x]', implementationType: 'none', implementation: 'Shipped: done.' })], result)
    expect(result.failures.some((f) => f.includes('Implementation Type none'))).toBe(true)
  })

  it('fails when anchor does not match row ID', () => {
    const result = makeResult()
    // B-001 expects id="b-001" but line has wrong anchor
    checkBacklog([makeRow({ line: 'id="b-999"' })], result)
    expect(result.failures.some((f) => f.includes('anchor must match'))).toBe(true)
  })

  it('fails when shipped item still says not implemented', () => {
    const result = makeResult()
    checkBacklog([makeRow({ status: '[x]', implementation: 'Not implemented yet.', implementationType: 'guardrail' })], result)
    expect(result.failures.some((f) => f.includes('not implemented'))).toBe(true)
  })

  it('accepts all valid statuses', () => {
    for (const status of ['[ ]', '[x]', '[~]', 'Deprioritized']) {
      const result = makeResult()
      const implementation = status === '[x]' ? 'Shipped: done.' : 'Not implemented yet.'
      checkBacklog(
        [makeRow({ status, implementation, implementationType: 'guardrail' })],
        result,
      )
      const statusFailures = result.failures.filter((f) => f.includes('invalid status'))
      expect(statusFailures).toHaveLength(0)
    }
  })
})

// ── checkBacklogSpecificity ───────────────────────────────────────────────────

describe('checkBacklogSpecificity', () => {
  it('produces no warnings for a specific row', () => {
    const result = makeResult()
    checkBacklogSpecificity([makeRow()], result)
    expect(result.warnings).toHaveLength(0)
  })

  it('warns for vague item names ending in reserved keywords', () => {
    const result = makeResult()
    checkBacklogSpecificity([makeRow({ item: 'Auth governance' })], result)
    expect(result.warnings.some((w) => w.includes('vague item names'))).toBe(true)
  })

  it('warns for open rows missing a Do: instruction in Problem', () => {
    const result = makeResult()
    checkBacklogSpecificity([makeRow({ problem: 'Users cannot do X.' })], result)
    expect(result.warnings.some((w) => w.includes('Do:'))).toBe(true)
  })
})

// ── checkFeatureFlags ─────────────────────────────────────────────────────────

describe('checkFeatureFlags', () => {
  const validFlag = {
    name: 'myFeature',
    owner: 'Roy',
    state: 'enabled',
    createdAt: '2025-01-01',
    reviewAt: '2026-01-01',
    description: 'Some feature',
    enabled: true,
  }

  it('fails when flags array is empty', () => {
    const result = makeResult()
    checkFeatureFlags([], '2026-01-01', result)
    expect(result.failures.some((f) => f.includes('must define metadata-backed feature flags'))).toBe(true)
  })

  it('returns zero count for empty flags', () => {
    const result = makeResult()
    const out = checkFeatureFlags([], '2026-01-01', result)
    expect(out.count).toBe(0)
  })

  it('fails when a required field is missing', () => {
    const result = makeResult()
    checkFeatureFlags([{ ...validFlag, owner: '' }], '2026-01-01', result)
    expect(result.failures.some((f) => f.includes('is missing owner'))).toBe(true)
  })

  it('fails when dates are not in YYYY-MM-DD format', () => {
    const result = makeResult()
    checkFeatureFlags([{ ...validFlag, createdAt: '01/01/2025' }], '2026-01-01', result)
    expect(result.failures.some((f) => f.includes('must use YYYY-MM-DD dates'))).toBe(true)
  })

  it('warns when a disabled flag is past its review date', () => {
    const result = makeResult()
    checkFeatureFlags(
      [{ ...validFlag, enabled: false, reviewAt: '2024-01-01' }],
      '2026-01-01',
      result,
    )
    expect(result.warnings.some((w) => w.includes('past review date'))).toBe(true)
  })

  it('does not warn for a disabled flag within its review date', () => {
    const result = makeResult()
    checkFeatureFlags(
      [{ ...validFlag, enabled: false, reviewAt: '2030-01-01' }],
      '2026-01-01',
      result,
    )
    expect(result.warnings.filter((w) => w.includes('past review date'))).toHaveLength(0)
  })

  it('warns when a flag has no references', () => {
    const { referencesForFlag } = require('../../../../scripts/ops/lib/feature-flags')
    referencesForFlag.mockReturnValueOnce([])
    const result = makeResult()
    checkFeatureFlags([validFlag], '2026-01-01', result)
    expect(result.warnings.some((w) => w.includes('not referenced outside'))).toBe(true)
  })

  it('produces no failures for a valid flag with references', () => {
    const result = makeResult()
    checkFeatureFlags([validFlag], '2026-01-01', result)
    expect(result.failures).toHaveLength(0)
  })
})

// ── checkBacklogEvidence ──────────────────────────────────────────────────────

describe('checkBacklogEvidence', () => {
  function makeBacklogRow(id: string, status: string, implementationType = 'guardrail') {
    return { id, status, implementationType, item: 'Some item', why: 'Some reason' }
  }

  const smallRules = new Map([['B-001', ['package.json', 'scripts/check-hygiene.js']]])

  it('verifies item when all evidence files exist and item is shipped', () => {
    const result = makeResult()
    const backlogById = new Map([['B-001', makeBacklogRow('B-001', '[x]')]])
    const out = checkBacklogEvidence(backlogById, result, {
      evidenceRules: smallRules,
      existsFn: () => true,
    })
    expect(out.verified).toContain('B-001')
    expect(result.warnings).toHaveLength(0)
  })

  it('warns when all evidence exists but item is not marked shipped', () => {
    const result = makeResult()
    const backlogById = new Map([['B-001', makeBacklogRow('B-001', '[ ]')]])
    checkBacklogEvidence(backlogById, result, {
      evidenceRules: smallRules,
      existsFn: () => true,
    })
    expect(result.warnings.some((w) => w.includes('not marked shipped'))).toBe(true)
  })

  it('warns when item is marked shipped but evidence files are missing', () => {
    const result = makeResult()
    const backlogById = new Map([['B-001', makeBacklogRow('B-001', '[x]')]])
    checkBacklogEvidence(backlogById, result, {
      evidenceRules: smallRules,
      existsFn: () => false,
    })
    expect(result.warnings.some((w) => w.includes('missing evidence'))).toBe(true)
  })

  it('skips items not present in backlogById', () => {
    const result = makeResult()
    const backlogById = new Map<string, unknown>()
    const out = checkBacklogEvidence(backlogById, result, {
      evidenceRules: smallRules,
      existsFn: () => true,
    })
    expect(out.verified).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  it('tracks items with partial evidence as missingEvidence', () => {
    const result = makeResult()
    const backlogById = new Map([['B-001', makeBacklogRow('B-001', '[ ]')]])
    const out = checkBacklogEvidence(backlogById, result, {
      evidenceRules: smallRules,
      existsFn: (f) => f === 'package.json',
    })
    expect(out.missingEvidence).toHaveLength(1)
    expect(out.missingEvidence[0]?.missing).toContain('scripts/check-hygiene.js')
  })
})

// ── checkBacklog [x] enforcement ─────────────────────────────────────────────

describe('checkBacklog — [x] row enforcement', () => {
  it('fails when a [x] row is present in BACKLOG.md', () => {
    const result = makeResult()
    checkBacklog(
      [makeRow({ status: '[x]', implementation: 'Shipped: done.', implementationType: 'guardrail', command: 'Do: verify.' })],
      result,
    )
    expect(result.failures.some((f) => f.includes('move it to COMPLETED_ITEMS.md'))).toBe(true)
  })

  it('does not emit [x] failure for active rows', () => {
    const result = makeResult()
    checkBacklog([makeRow({ status: '[ ]' })], result)
    expect(result.failures.some((f) => f.includes('move it to COMPLETED_ITEMS.md'))).toBe(false)
  })
})

// ── checkBacklogStructure ─────────────────────────────────────────────────────

describe('checkBacklogStructure', () => {
  it('produces no failures for valid content', () => {
    const result = makeResult()
    checkBacklogStructure(
      '## Roy Actionables\n\n| Status | Priority |\n| --- | --- |\n| [ ] | P0 |\n\n---\n',
      result,
    )
    expect(result.failures).toHaveLength(0)
  })

  it('fails on consecutive --- separators', () => {
    const result = makeResult()
    checkBacklogStructure('---\n---\n', result)
    expect(result.failures.some((f) => f.includes('consecutive'))).toBe(true)
  })

  it('fails on consecutive --- separators with blank line between', () => {
    const result = makeResult()
    checkBacklogStructure('---\n\n---\n', result)
    expect(result.failures.some((f) => f.includes('consecutive'))).toBe(true)
  })

  it('fails when a heading is immediately followed by another heading', () => {
    const result = makeResult()
    checkBacklogStructure('## Section A\n\n## Section B\n\n| x |\n', result)
    expect(result.failures.some((f) => f.includes('Section A') && f.includes('empty'))).toBe(true)
  })

  it('fails when a heading is immediately followed by ---', () => {
    const result = makeResult()
    checkBacklogStructure('## Empty Section\n\n---\n', result)
    expect(result.failures.some((f) => f.includes('Empty Section') && f.includes('empty'))).toBe(true)
  })

  it('does not fail for a heading with a table row', () => {
    const result = makeResult()
    checkBacklogStructure('## With Content\n\n| Status |\n| --- |\n| [ ] |\n\n---\n', result)
    expect(result.failures.some((f) => f.includes('With Content'))).toBe(false)
  })

  it('does not fail for a heading with prose content', () => {
    const result = makeResult()
    checkBacklogStructure('## With Prose\n\nSome description here.\n\n---\n', result)
    expect(result.failures.some((f) => f.includes('With Prose'))).toBe(false)
  })
})

// ── checkCompletedItemsOrder ──────────────────────────────────────────────────

describe('checkCompletedItemsOrder', () => {
  it('produces no failures for ascending IDs', () => {
    const result = makeResult()
    checkCompletedItemsOrder(
      '<a id="b-074"></a>B-074\n<a id="b-239"></a>B-239\n<a id="b-240"></a>B-240\n',
      result,
    )
    expect(result.failures).toHaveLength(0)
  })

  it('fails when an ID is out of ascending order', () => {
    const result = makeResult()
    checkCompletedItemsOrder(
      '<a id="b-240"></a>B-240\n<a id="b-074"></a>B-074\n',
      result,
    )
    expect(result.failures.some((f) => f.includes('out of ascending order'))).toBe(true)
  })

  it('produces no failures for letter-suffix IDs in correct position', () => {
    const result = makeResult()
    checkCompletedItemsOrder(
      '<a id="b-532"></a>B-532\n<a id="b-532b"></a>B-532b\n<a id="b-533"></a>B-533\n',
      result,
    )
    expect(result.failures).toHaveLength(0)
  })

  it('fails when a letter-suffix ID appears before its base ID', () => {
    const result = makeResult()
    checkCompletedItemsOrder(
      '<a id="b-532b"></a>B-532b\n<a id="b-532"></a>B-532\n',
      result,
    )
    expect(result.failures.some((f) => f.includes('out of ascending order'))).toBe(true)
  })
})
