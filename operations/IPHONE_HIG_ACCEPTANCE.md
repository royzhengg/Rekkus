# iPhone HIG Release Acceptance

This append-only register records manual iPhone accessibility and interaction evidence for beta and production release candidates. A passing record is required for the exact build being promoted. Material-bearing builds must verify the opaque fallback with iOS Reduce Transparency enabled.

## Rules

- Add a new `Release Candidate` section for each beta or production build; do not edit a prior result to reuse it for another build.
- Execute the matrix on a physical iPhone release-candidate build. Simulator observations may supplement, but cannot satisfy, the promotion gate.
- Use only `PASS`, `FAIL`, `BLOCKED (B-###)`, or `N/A (<reason>)` in result cells.
- A release candidate is promotable only when every required cell is `PASS` or a justified `N/A (<reason>)`.
- Run `REKKUS_RELEASE_CANDIDATE=<build-id> npm run check:release` after recording a candidate pass.

## Release Candidate: `baseline-blocked-2026-05-27`

Initial readiness record. `B-526` through `B-528` have introduced static/accessibility and recovery safeguards, but no device acceptance is claimed until the physical-iPhone pass is run and the remaining critical HIG work is closed.

| Field                    | Value                        |
| ------------------------ | ---------------------------- |
| Environment              | pre-release baseline         |
| App/build version        | Not yet tested               |
| Test date                | 2026-05-27                   |
| Tester                   | Pending release owner        |
| Device type              | Pending physical iPhone pass |
| iPhone model             | Not yet tested               |
| iOS version              | Not yet tested               |
| Rollback/build reference | Not yet available            |

| Journey    | VoiceOver       | Dynamic Type    | Reduce Motion   | Reduce Transparency | Dark Mode       | Permission Timing/Recovery | Touch Target/Semantics |
| ---------- | --------------- | --------------- | --------------- | ------------------- | --------------- | -------------------------- | ---------------------- |
| Onboarding | BLOCKED (B-530) | BLOCKED (B-530) | BLOCKED (B-530) | BLOCKED (B-531)     | BLOCKED (B-530) | BLOCKED (B-530)            | BLOCKED (B-530)        |
| Auth       | BLOCKED (B-530) | BLOCKED (B-530) | BLOCKED (B-530) | BLOCKED (B-531)     | BLOCKED (B-530) | BLOCKED (B-530)            | BLOCKED (B-530)        |
| Feed       | BLOCKED (B-530) | BLOCKED (B-530) | BLOCKED (B-530) | BLOCKED (B-531)     | BLOCKED (B-530) | BLOCKED (B-530)            | BLOCKED (B-530)        |
| Search     | BLOCKED (B-530) | BLOCKED (B-530) | BLOCKED (B-530) | BLOCKED (B-531)     | BLOCKED (B-530) | BLOCKED (B-530)            | BLOCKED (B-530)        |
| Saved      | BLOCKED (B-530) | BLOCKED (B-530) | BLOCKED (B-530) | BLOCKED (B-531)     | BLOCKED (B-530) | BLOCKED (B-530)            | BLOCKED (B-530)        |
| Create     | BLOCKED (B-530) | BLOCKED (B-530) | BLOCKED (B-530) | BLOCKED (B-531)     | BLOCKED (B-530) | BLOCKED (B-530)            | BLOCKED (B-530)        |
| Restaurant | BLOCKED (B-530) | BLOCKED (B-530) | BLOCKED (B-530) | BLOCKED (B-531)     | BLOCKED (B-530) | BLOCKED (B-530)            | BLOCKED (B-530)        |
| Messaging  | BLOCKED (B-530) | BLOCKED (B-530) | BLOCKED (B-530) | BLOCKED (B-531)     | BLOCKED (B-530) | BLOCKED (B-530)            | BLOCKED (B-530)        |
| Settings   | BLOCKED (B-530) | BLOCKED (B-530) | BLOCKED (B-530) | BLOCKED (B-531)     | BLOCKED (B-530) | BLOCKED (B-530)            | BLOCKED (B-530)        |
