# Mention Parsing

Canonical constants for @mention extraction. Both the TypeScript parser and the SQL trigger must use these values. If either changes, update both and the ADR.

See also: [notifications.md](notifications.md), [ADR-0032](../adr/ADR-0032-mention-notification-pipeline.md)

## Constants

| Constant | Value |
| --- | --- |
| `MAX_MENTIONS` | 20 |
| `MAX_PARSE_LENGTH` | 10 000 chars |
| `MENTION_REGEX` (TypeScript) | `/(?<![A-Za-z0-9])@([A-Za-z0-9_]+)/g` |
| `MENTION_REGEX` (SQL / POSIX ERE) | `'(?:^|[^[:alnum:]])@([[:alnum:]_]+)'` — use capture group 2 |

The two regexes differ syntactically because PostgreSQL uses POSIX ERE, which does not support negative lookbehind (`(?<!...)`). They are behaviourally equivalent. Do not attempt to unify them.

## Parsing contract

| Input | Result |
| --- | --- |
| `@alice` | `alice` |
| `@Alice` | `alice` (lowercased) |
| `@alice_bob` | `alice_bob` |
| `@@alice` | no match |
| `email@test.com` | no match (preceded by alphanumeric) |
| `hello@company.com` | no match |
| `@日本` | no match (non-ASCII excluded) |
| `@john-doe` | `john` only (hyphen not in charset) |
| `@alice.` `@alice,` `@alice!` `(@alice)` `"@alice"` | `alice` |
| > 20 unique mentions | first 20 kept, remainder silently ignored |
| Content > 10 000 chars | only first 10 000 chars parsed |

Post-match normalisation: trim, lowercase, deduplicate, filter actor's own username, cap at 20.

## Username validation

Username validation rules are owned by the Users domain. Mention parsing intentionally mirrors, but does not define, username syntax. If username rules change, update both parsers.

## Changing these constants

Changing `MAX_MENTIONS`, `MAX_PARSE_LENGTH`, or either regex is a **breaking behavioural change**. You must update:

1. This file
2. The ADR
3. `lib/social/mentions.ts` (TypeScript parser)
4. `parse_mention_usernames()` (SQL helper function)
5. Tests in `tests/unit/lib/social/mentions.test.ts`
