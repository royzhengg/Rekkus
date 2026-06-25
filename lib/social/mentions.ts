// Non-authoritative — for editor UI only (autocomplete, highlighting).
// Notification behaviour is determined by the database trigger, not this file.
// Constants must stay in sync with parse_mention_usernames() in SQL.
// See docs/social/mentions.md for the authoritative constants and parsing contract.

const MENTION_RE = /(?<![A-Za-z0-9])@([A-Za-z0-9_]+)/g

export const MENTION_CONSTANTS = {
  MAX_MENTIONS: 20,
  MAX_PARSE_LENGTH: 10_000,
} as const

export function parseMentions(text: string | null): string[] {
  if (!text) return []
  const slice = text.slice(0, MENTION_CONSTANTS.MAX_PARSE_LENGTH)
  const usernames = [...slice.matchAll(MENTION_RE)].flatMap(m => m[1] ? [m[1].toLowerCase()] : [])
  return [...new Set(usernames)].slice(0, MENTION_CONSTANTS.MAX_MENTIONS)
}
