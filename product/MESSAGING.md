# Messaging

Messaging is Rekkus's private social coordination layer — designed for sharing food intent, planning visits, and sending posts and places between trusted users. It must not distract from saves, collections, dish graph density, or local discovery.

## Current State

Direct messaging is fully implemented and live behind `directMessages: enabled: true`. The feature supports rich media, group conversations, message requests, reactions, replies, typing indicators, and Rekkus-specific sharing (posts and places).

## Product Rules

- Messaging starts from a profile, post, restaurant, or collection context — it is not a generic chat-first surface.
- Conversations are participant-only under Supabase RLS at all times.
- Senders the recipient does not follow reach a Message Requests inbox, not the main inbox.
- Group chats require at least 2 other participants; only admins can add/remove members.
- Message notifications are utility-first and must respect `notif_messages`, cooldowns, and abuse controls.
- Pending message requests do not generate normal message push alerts until accepted.
- Unread badges and read receipts are allowed only after read-state writes are reliable.
- Private message content must never appear in analytics event payloads or server logs.
- Realtime enhances an open conversation; it is not required for basic send/read behaviour.

## Supported Message Types

| Type | Description |
|---|---|
| `text` | Plain text up to 2,000 characters |
| `image` | Photo from camera or library (JPEG, PNG, WEBP, HEIC, HEIF); CSAM-scanned |
| `video` | Video up to 60s / 100 MB (MP4, MOV, M4V); CSAM-scanned |
| `audio` | Voice note up to 25 MB |
| `gif` | Animated GIF via GIPHY (external URL; requires platform-specific GIPHY public API keys) |
| `sticker` | Rekkus-branded sticker from public sticker pack |
| `file` | Document or file up to 50 MB |
| `location` | Current GPS location as a rich map card; tap to open Maps |
| `post_share` | Rekkus post card linking to post detail |
| `place_share` | Rekkus restaurant/place card (name, address, directions link); sendable from saved places or restaurant detail |
| `system` | System message (member added, member left, group renamed) |

## Conversation Types

- `direct` — 1:1 conversation between two users
- `group` — group conversation; requires name; admin role enforced via RPC

## Message Requests

Requests are evaluated from the recipient's perspective:

- **Direct chats** — if the recipient follows the sender, the conversation is active for both users. If the recipient does not follow the sender, the sender's participant state is active but the recipient's participant state is `request`.
- **Group chats** — each invited member gets an independent participant `request_status`. Members who follow the creator enter as active; members who do not follow the creator see the group under Message Requests until they accept.
- **Accept** — sets only the current user's participant state to active and lets the conversation appear in their main inbox.
- **Decline** — sets the current user's participant state to declined; for direct chats the conversation is blocked, while group declines do not affect other members.

Migration note: per-participant group request routing requires `20240216000000_message_request_participant_state.sql`. During local/dev schema drift, the client falls back to legacy `conversations.status` request handling so existing inboxes do not disappear.

## Inbox Entry Points

The Messages screen keeps conversation content first. Search sits above the inbox list, pending message requests appear as a small inline row only when there is at least one pending request, and lower-frequency management entries live in the header overflow menu.

- **Message requests** — `/messages/requests`; always reachable from the header menu, surfaced inline only when pending.
- **Archived chats** — `/messages/archived`; reachable from the header menu, not shown as an inbox row.
- **Main inbox** — active, non-archived conversations where the current user's participant `request_status='active'`.

## Conversation Management

Users can (from the inbox via swipe or from the Info screen):
- **Pin** — float a conversation to the top of the inbox
- **Mute** — suppress notifications for 1h, 8h, 24h, 1 week, or indefinitely
- **Archive** — hide from main inbox; accessible from the Messages header menu
- **Mark as unread** — reset read state to show unread indicator
- **Leave group** — auto-promotes admin if leaving member was the last admin
- **Delete** (1:1) — archives from the user's perspective

## Composer Attachments

The conversation composer uses a compact icon tray instead of a text-only attachment menu:

- **Camera** — always visible as a one-tap photo shortcut.
- **Media** — opens the system picker for both photos and videos, then sends the selected asset as `image` or `video`.
- **GIF** — opens a searchable GIPHY picker and sends the selected external GIF URL as `message_type='gif'`; uses `EXPO_PUBLIC_GIPHY_IOS_API_KEY` or `EXPO_PUBLIC_GIPHY_ANDROID_API_KEY` by platform.
- **Location** — offers current location or a saved place.
- **File** — opens the document picker.

## Safety and Moderation

- All image and video attachments pass through the `moderate-content` Edge Function (CSAM hash check + NCMEC reporting) before the message record is created.
- Text messages are checked against a keyword blocklist.
- Spam rate limits: 10 messages/min per conversation, 50/hr globally; new accounts (<7 days) have lower limits.
- Blocked users cannot initiate or continue conversations (enforced at RPC level).
- Recipients must accept a pending request before their participant state can send messages.
- User report and block affordances are present in every conversation.
- See [../docs/moderation/MODERATION_OPERATIONS.md](../docs/moderation/MODERATION_OPERATIONS.md) for the full moderation playbook.

## Message Interactions

- **Search** — in-conversation search bar (toggle via header icon); searches text messages by body
- **Multiple pinned messages** — any participant can pin/unpin messages; all pinned messages visible in the Info screen
- **Reactions** — 6 emoji reactions per message (❤️ 👍 😂 😮 😢 🔥); real-time via Supabase Realtime; one reaction per user; tapping own reaction removes it
- **Reply** — long-press → Reply (works for own messages and others'); quoted bubble shows sender name and message preview; tapping quoted preview scrolls to original
- **Delete** — sender can delete own message; body + attachment nulled immediately (true erasure)
- **Forward** — copies message body/attachment to another conversation
- **Timestamp** — timestamps are hidden by default; tap any bubble to reveal the sent time; tap again to hide
- **Bubble colours** — own messages use the brand accent colour (terracotta); incoming messages use the surface colour

## Shared Media

- The Info screen shows a media grid of all photos and videos shared in the conversation
- Tap any item to view full-screen

## Rollout History

| Step | Backlog ID | Status |
|---|---|---|
| DB foundation (rich messages, groups, online status, pinned messages) | B-461 | ✅ Complete |
| Supabase Storage `message-attachments` bucket | B-462 | Needs manual apply |
| CSAM + moderation Edge Function | B-463 | ✅ Complete |
| NCMEC ESP registration | B-464 | External — manual |
| Service layer expansion | B-465, B-466 | ✅ Complete |
| Rich input + rendering | B-467, B-468 | ✅ Complete |
| Message interactions (reactions, reply, delete, forward, pin) | B-469 | ✅ Complete |
| UX layer (typing, online status, day separators, read receipts, pinned banner, link safety) | B-470 | ✅ Complete |
| Message requests inbox | B-471 | ✅ Complete |
| Conversation Info screen (media gallery, group management, mute/archive/pin/unread) | B-472 | ✅ Complete |
| Group chats | B-473 | ✅ Complete |
| Post and place sharing entry points | B-476 | ✅ Complete |
| Conversation management (mute, archive, pin, mark unread, leave group) | B-477 | ✅ Complete |
| Feature flag enabled | B-479 | ✅ Complete |
| Multiple pinned messages (new migration) | B-442+ | ✅ Complete |

## Guardrails

- Keep private message body and attachment URL out of all analytics events and server logs.
- Do not add message search, public inbox counts, or growth prompts before moderation and blocking paths are confirmed working.
- Do not send message body preview in push notification payloads; use generic copy only.
- All group mutations (create, add member, remove member, promote admin) must go through security-definer RPCs — never direct table inserts.
- CSAM detection must be active before any image or video send path is open to users.
- Run `check:rls` and `check:compliance` after every messaging migration.
