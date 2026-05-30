// Tests for scripts/lib/args.js — shared CLI argument utilities.
// These are the canonical helpers used by all scripts/; test coverage
// here guards against regressions when the utility is modified.

const { parseFlags, hasFlag, getArg, isCI, useColor } = require('../../../../scripts/lib/args') as {
  parseFlags: (argv?: string[]) => Set<string>
  hasFlag: (flag: string, argv?: string[]) => boolean
  getArg: (flag: string, argv?: string[]) => string | null
  isCI: () => boolean
  useColor: () => boolean
}

describe('parseFlags', () => {
  it('returns a Set containing each passed flag', () => {
    const flags = parseFlags(['--json', '--summary', '--write'])
    expect(flags.has('--json')).toBe(true)
    expect(flags.has('--summary')).toBe(true)
    expect(flags.has('--write')).toBe(true)
  })

  it('returns an empty Set for an empty argv', () => {
    expect(parseFlags([])).toEqual(new Set())
  })

  it('does not include flags that were not passed', () => {
    const flags = parseFlags(['--json'])
    expect(flags.has('--summary')).toBe(false)
  })
})

describe('hasFlag', () => {
  it('returns true when the flag is present', () => {
    expect(hasFlag('--json', ['--json', '--summary'])).toBe(true)
  })

  it('returns false when the flag is absent', () => {
    expect(hasFlag('--json', ['--summary'])).toBe(false)
  })

  it('returns false for an empty argv', () => {
    expect(hasFlag('--help', [])).toBe(false)
  })
})

describe('getArg', () => {
  it('returns the value immediately after the flag', () => {
    expect(getArg('--to', ['--to', '3.1.0'])).toBe('3.1.0')
  })

  it('returns the correct value when other flags precede it', () => {
    expect(getArg('--to', ['--run', '--to', '4.0.0'])).toBe('4.0.0')
  })

  it('returns null when the flag is absent', () => {
    expect(getArg('--to', ['--run'])).toBeNull()
  })

  it('returns null when the flag is the last element (no following value)', () => {
    expect(getArg('--to', ['--run', '--to'])).toBeNull()
  })

  it('returns null for an empty argv', () => {
    expect(getArg('--to', [])).toBeNull()
  })
})

describe('isCI', () => {
  const originalCI = process.env.CI

  afterEach(() => {
    if (originalCI === undefined) {
      delete process.env.CI
    } else {
      process.env.CI = originalCI
    }
  })

  it('returns true when CI=true', () => {
    process.env.CI = 'true'
    expect(isCI()).toBe(true)
  })

  it('returns false when CI=false', () => {
    process.env.CI = 'false'
    expect(isCI()).toBe(false)
  })

  it('returns false when CI is unset', () => {
    delete process.env.CI
    expect(isCI()).toBe(false)
  })
})

describe('useColor', () => {
  const originalCI = process.env.CI

  afterEach(() => {
    if (originalCI === undefined) {
      delete process.env.CI
    } else {
      process.env.CI = originalCI
    }
  })

  it('returns false in CI regardless of TTY', () => {
    process.env.CI = 'true'
    expect(useColor()).toBe(false)
  })

  it('returns false when not in CI and stdout is not a TTY', () => {
    process.env.CI = 'false'
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true })
    expect(useColor()).toBe(false)
  })
})
