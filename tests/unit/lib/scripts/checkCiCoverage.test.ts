// Tests for the extractChildScripts function in scripts/check-ci-coverage.js.
// This function parses shell command strings to find composed npm script names —
// it is fragile because it uses regex and must handle edge cases correctly.
// These tests guard against silent breakage when the command format drifts.

const { extractChildScripts } = require('../../../../scripts/check-ci-coverage') as {
  extractChildScripts: (command: string) => string[]
}

describe('extractChildScripts', () => {
  it('extracts a single npm run script', () => {
    expect(extractChildScripts('npm run check:hygiene')).toEqual(['check:hygiene'])
  })

  it('extracts multiple npm run scripts chained with &&', () => {
    expect(extractChildScripts('npm run check:platform && npm run check:hygiene')).toEqual([
      'check:platform',
      'check:hygiene',
    ])
  })

  it('extracts scripts from run-parallel.js invocations', () => {
    expect(
      extractChildScripts('node scripts/run-parallel.js check:coverage check:tokens check:darkmode')
    ).toEqual(['check:coverage', 'check:tokens', 'check:darkmode'])
  })

  it('extracts both npm run and run-parallel scripts in the same command', () => {
    expect(
      extractChildScripts('npm run check:hygiene && node scripts/run-parallel.js check:a check:b')
    ).toEqual(['check:hygiene', 'check:a', 'check:b'])
  })

  it('returns an empty array for commands with no npm scripts', () => {
    expect(extractChildScripts('echo hello && ls')).toEqual([])
  })

  it('returns an empty array for an empty command string', () => {
    expect(extractChildScripts('')).toEqual([])
  })

  it('handles script names with colons correctly', () => {
    expect(extractChildScripts('npm run test:unit')).toEqual(['test:unit'])
    expect(extractChildScripts('npm run check:supabase-types')).toEqual(['check:supabase-types'])
  })

  it('stops extracting run-parallel script names at trailing options', () => {
    const result = extractChildScripts(
      'node scripts/run-parallel.js check:dr check:privacy check:rls'
    )
    expect(result).toContain('check:dr')
    expect(result).toContain('check:privacy')
    expect(result).toContain('check:rls')
    expect(result).toHaveLength(3)
  })
})
