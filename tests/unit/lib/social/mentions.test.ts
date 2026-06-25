import { MENTION_CONSTANTS, parseMentions } from '@/lib/social/mentions'

describe('parseMentions', () => {
  it('returns empty array for null input', () => {
    expect(parseMentions(null)).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parseMentions('')).toEqual([])
  })

  it('returns empty array when no mentions present', () => {
    expect(parseMentions('hello world, no mentions here')).toEqual([])
  })

  it('parses a single mention', () => {
    expect(parseMentions('hey @alice')).toEqual(['alice'])
  })

  it('parses a mention at start of string', () => {
    expect(parseMentions('@alice check this out')).toEqual(['alice'])
  })

  it('lowercases mentions', () => {
    expect(parseMentions('@Alice')).toEqual(['alice'])
    expect(parseMentions('@ALICE')).toEqual(['alice'])
  })

  it('parses multiple mentions', () => {
    expect(parseMentions('hey @alice and @bob')).toEqual(['alice', 'bob'])
  })

  it('deduplicates repeated mentions', () => {
    expect(parseMentions('@alice @alice @alice')).toEqual(['alice'])
  })

  it('deduplicates case-insensitively', () => {
    expect(parseMentions('@alice @Alice @ALICE')).toEqual(['alice'])
  })

  it('parses mentions with underscores and numbers', () => {
    expect(parseMentions('@alice_bob @user123')).toEqual(['alice_bob', 'user123'])
  })

  it('does not match email addresses', () => {
    expect(parseMentions('email@test.com')).toEqual([])
    expect(parseMentions('hello@company.com')).toEqual([])
    expect(parseMentions('user@example.org')).toEqual([])
  })

  it('stops at hyphens in usernames', () => {
    expect(parseMentions('@john-doe')).toEqual(['john'])
  })

  it('parses mentions with trailing punctuation', () => {
    expect(parseMentions('@alice.')).toEqual(['alice'])
    expect(parseMentions('@alice,')).toEqual(['alice'])
    expect(parseMentions('@alice!')).toEqual(['alice'])
    expect(parseMentions('@alice?')).toEqual(['alice'])
  })

  it('parses mentions inside parentheses and quotes', () => {
    expect(parseMentions('(@alice)')).toEqual(['alice'])
    expect(parseMentions('"@alice"')).toEqual(['alice'])
    expect(parseMentions('[@alice]')).toEqual(['alice'])
  })

  it('does not match non-ASCII usernames', () => {
    expect(parseMentions('@日本')).toEqual([])
    expect(parseMentions('@ñoño')).toEqual([])
  })

  it('caps results at MAX_MENTIONS (20)', () => {
    const text = Array.from({ length: 25 }, (_, i) => `@user${i}`).join(' ')
    const result = parseMentions(text)
    expect(result).toHaveLength(MENTION_CONSTANTS.MAX_MENTIONS)
  })

  it('only parses first MAX_PARSE_LENGTH characters', () => {
    const padding = 'x'.repeat(MENTION_CONSTANTS.MAX_PARSE_LENGTH - 5)
    const text = `${padding} @alice @bob`
    // @alice is within range, @bob is beyond
    const result = parseMentions(text)
    expect(result).not.toContain('bob')
  })

  it('self-mention is returned by parser (trigger filters, not parser)', () => {
    expect(parseMentions('@self')).toEqual(['self'])
  })

  it('parser returns username regardless of whether user exists in DB', () => {
    expect(parseMentions('@unknownxyz999')).toEqual(['unknownxyz999'])
  })
})
