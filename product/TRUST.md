# Trust

Owner: Product / security

Trust is the condition for discovery to feel useful. Users should believe recommendations are real, local, and not secretly pay-to-rank.

## Product Rules

- Prefer transparent signals over opaque ranking.
- Keep paid placement transparent if monetization is added.
- Disclose review incentives, restaurant-owner influence, sponsored placement, or paid boosts before users can mistake them for organic recommendations.
- Do not selectively remove negative reviews for commercial pressure; use consistent dispute, takedown, and moderation rules.
- Protect user-private saves, settings, auth identities, and push tokens.
- Use RLS and service boundaries as security backstops.
- Preserve moderation and abuse work as product quality work, not only security work.

## Trust Signals

- Rekkus ratings and dish mentions from posts.
- Follow graph and reviewer profiles.
- Clear save/follow/comment auth gates.
- Reliable report, block, moderation, and incident paths as they are built.
- Report, block, dispute, and takedown paths for UGC and restaurant review issues.
- Ranking explanations that name the main factors without pretending to reveal exact weights.

## Current Safety Foundation

- Posts, comments, and profiles have a first report path backed by `content_reports`.
- Profiles and creators can be blocked through `user_blocks`.
- Moderation queue, moderation action, appeal, trust profile, and soft-delete tables exist before a full admin dashboard.
- AI moderation remains first-pass only and disabled until human review, appeal, provider, and audit boundaries are ready.

## Disputes And Takedowns

- Review disputes, fake-review reports, incentive disclosure reports, and takedown requests use the same `content_reports` queue with `report_type` set to the relevant case.
- Operator SLA before public beta: acknowledge credible legal/safety reports within 2 business days, triage urgent harm same day, and preserve moderation evidence without copying raw private exports into docs.
- Negative reviews are not removed because of commercial pressure; removal or restoration must be tied to a consistent moderation action and audit reason.

## Messaging Safety

- **Message report flow**: `submitContentReport` with `source_surface='message_thread'`; report reaches the standard `content_reports` queue.
- **CSAM scanning**: all image and video attachments pre-screened by `moderate-content` Edge Function before the message record is created; detected content blocked and quarantined; NCMEC CyberTipline report filed automatically; user account suspended pending human review within 24h.
- **Spam detection**: rate limits (10 msg/min per conversation, 50/hr globally; lower for new accounts); repeated message detection; violations recorded in `user_trust_profiles`.
- **Message requests**: senders the recipient does not follow are gated by default; direct and group requests use participant-level state, and only accepted conversations reach the recipient's main inbox.
- **Message deletion semantics**: body + attachment nulled immediately on user delete; message row retained with `deleted_at` for audit continuity; not reversible.

## Owner Links

- Security controls: [../docs/security/SECURITY.md](../docs/security/SECURITY.md)
- Analytics privacy: [../docs/analytics/ANALYTICS.md](../docs/analytics/ANALYTICS.md)
- Compliance, provider terms, privacy rights, audit evidence, retention, deletion/export, and ISO readiness: [../docs/security/COMPLIANCE.md](../docs/security/COMPLIANCE.md)
- Release safety: [../operations/RELEASE.md](../operations/RELEASE.md)
