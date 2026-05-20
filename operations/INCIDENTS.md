# Incidents And Support

This doc owns lightweight incident and support handling until dedicated tooling exists.

Owner: founder/operator until dedicated support ownership exists.

## Severity

| Severity | Meaning | Response |
| --- | --- | --- |
| S1 | Production unavailable, data loss risk, secret exposure, or severe abuse | Stop release work, contain, document, and escalate immediately. |
| S2 | Major user flow broken or high-risk provider failure | Triage same day, identify rollback or mitigation. |
| S3 | Degraded feature, isolated support issue, or minor operational gap | Track in backlog and schedule by priority. |

## Incident Notes

Record incidents with:

- Date.
- Severity.
- Impact.
- Root cause.
- Mitigation.
- Follow-up backlog items.
- Owner for containment and follow-up.

For privacy/security incidents, also record:

- affected data categories and approximate affected-user count
- containment status and evidence preserved
- whether OAIC Notifiable Data Breaches assessment is needed
- regulator, provider, app-store, or user notification decision
- notification owner and deadline

Do not store raw private exports, secrets, provider payloads, passwords, reset links, or unnecessary PII in markdown.

## Notification Templates

Use short templates and fill only verified facts:

- Internal: incident summary, severity, current impact, owner, next review time, and immediate containment.
- User-facing: what happened, what data may be affected, what Rekkus has done, what the user should do, and support contact.
- OAIC/NDB draft: entity, contact, incident description, affected information, likely harm assessment, containment steps, and user notification plan.

## Support Rules

- Convert repeated support issues into backlog work.
- Update product, security, release, or operations docs when support reveals stale truth.
- Never store private user data in markdown notes.
