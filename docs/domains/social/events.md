# Social Events

`social_events` is the canonical user-facing activity ledger for Alerts.

Event naming uses `verb_object`:

- `like_post`
- `comment_post`
- `reply_comment`
- `follow`
- `follow_request_pending`
- `follow_request_approved`

## Event Generation Rules

| Action | Follow row | Request state | Social event | Delivery | Audit |
| --- | --- | --- | --- | --- | --- |
| Send request | no | `pending` | `follow_request_pending` | yes | yes |
| Approve one | yes | `approved` | `follow_request_approved` | yes | yes |
| Approve all | yes | `approved`, `bulk` | `follow_request_approved` | yes | yes |
| Auto-approve on public | yes | `approved`, `auto_public` | `follow_request_approved` | yes | yes |
| Decline/delete | no | `declined` | no | no | yes |
| Requester cancel | no | `cancelled` | no | no | yes |
| Block pending requester | no | `declined/cancelled` | no visible event | no | yes |

Metadata must stay privacy-safe: no usernames, captions, private text, place names, message bodies, or media URLs.
