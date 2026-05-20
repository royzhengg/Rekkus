---
name: feedback-guardrail-protocol
description: When a new recurring violation class is found, always ship a CI guardrail script alongside the fix — not after.
metadata:
  type: feedback
---

When discovering a recurring violation class (god components, hardcoded colors, service boundary imports, etc.), the correct response is to create a guardrail script immediately:

1. Write `scripts/check-<name>.sh` that greps/counts for the violation pattern and exits 1 on new violations.
2. Allowlist all **existing** violations in the script so CI doesn't hard-break on pre-existing issues.
3. Track each allowlisted violation as a backlog item (ARCH-xxx / DS-xxx) to be fixed.
4. Wire into `package.json` as `check:<name>`.
5. Add to `check:hygiene` composite.
6. Add a CI step in `.github/workflows/ops-checks.yml`.
7. Add to the `REQUIRED` array in `scripts/check-ci-coverage.js` so future omissions are caught.

**Why:** "also make sure this never happens again" — user expectation is that guardrails are always part of the fix, not follow-up work. A fix without a guardrail is incomplete.

**How to apply:** Any time a bug fix or sweep reveals a class of violation, implement the guardrail in the same PR. Do not ship the fix and leave the guardrail as a separate backlog item.
