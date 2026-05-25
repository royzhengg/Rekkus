import {
  PASSWORD_MIN_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  isValidPassword,
  passwordMinLengthMessage,
  passwordsMatch,
  hasCurrentPassword,
  isValidEmail,
  isValidUsername,
} from '@/lib/utils/validation'

describe('validation constants', () => {
  it('PASSWORD_MIN_LENGTH is 8', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8)
  })

  it('USERNAME_MIN_LENGTH is 3', () => {
    expect(USERNAME_MIN_LENGTH).toBe(3)
  })

  it('USERNAME_MAX_LENGTH is 30', () => {
    expect(USERNAME_MAX_LENGTH).toBe(30)
  })
})

describe('isValidPassword', () => {
  it('rejects passwords shorter than 8 characters', () => {
    expect(isValidPassword('')).toBe(false)
    expect(isValidPassword('abc')).toBe(false)
    expect(isValidPassword('1234567')).toBe(false)
  })

  it('accepts passwords of exactly 8 characters', () => {
    expect(isValidPassword('12345678')).toBe(true)
  })

  it('accepts passwords longer than 8 characters', () => {
    expect(isValidPassword('a'.repeat(100))).toBe(true)
    expect(isValidPassword('correcthorsebatterystaple')).toBe(true)
  })
})

describe('passwordMinLengthMessage', () => {
  it('returns a string', () => {
    expect(typeof passwordMinLengthMessage()).toBe('string')
  })

  it('mentions the minimum length of 8', () => {
    expect(passwordMinLengthMessage()).toContain('8')
  })
})

describe('passwordsMatch', () => {
  it('returns true when passwords are identical', () => {
    expect(passwordsMatch('hunter2', 'hunter2')).toBe(true)
    expect(passwordsMatch('', '')).toBe(true)
  })

  it('returns false when passwords differ', () => {
    expect(passwordsMatch('hunter2', 'hunter3')).toBe(false)
    expect(passwordsMatch('abc', 'ABC')).toBe(false)
    expect(passwordsMatch('abc', '')).toBe(false)
  })
})

describe('hasCurrentPassword', () => {
  it('returns false for empty string', () => {
    expect(hasCurrentPassword('')).toBe(false)
  })

  it('returns true for any non-empty string', () => {
    expect(hasCurrentPassword('x')).toBe(true)
    expect(hasCurrentPassword('my-password')).toBe(true)
  })
})

describe('isValidEmail', () => {
  it('accepts well-formed email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
    expect(isValidEmail('roy+tag@food.io')).toBe(true)
    expect(isValidEmail('a@b.c')).toBe(true)
  })

  it('accepts emails with surrounding whitespace (trims before checking)', () => {
    expect(isValidEmail('  user@example.com  ')).toBe(true)
  })

  it('rejects addresses without @', () => {
    expect(isValidEmail('userexample.com')).toBe(false)
  })

  it('rejects addresses without a domain part', () => {
    expect(isValidEmail('user@')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false)
  })

  it('rejects addresses with spaces inside', () => {
    expect(isValidEmail('user @example.com')).toBe(false)
  })
})

describe('isValidUsername', () => {
  it('accepts alphanumeric usernames within length bounds', () => {
    expect(isValidUsername('roy')).toBe(true)
    expect(isValidUsername('user_123')).toBe(true)
    expect(isValidUsername('a'.repeat(30))).toBe(true)
  })

  it('rejects usernames shorter than 3 characters', () => {
    expect(isValidUsername('')).toBe(false)
    expect(isValidUsername('ab')).toBe(false)
  })

  it('rejects usernames longer than 30 characters', () => {
    expect(isValidUsername('a'.repeat(31))).toBe(false)
  })

  it('rejects usernames with special characters', () => {
    expect(isValidUsername('user-name')).toBe(false)
    expect(isValidUsername('user name')).toBe(false)
    expect(isValidUsername('user@name')).toBe(false)
    expect(isValidUsername('user.name')).toBe(false)
  })
})
