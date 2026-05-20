# Dependency Governance

Dependency governance owns package, SDK, and provider dependency decisions that affect cost, security, bundle size, or maintenance.

## Rules

- Reuse existing dependencies before adding new ones.
- Add a dependency only when it clearly reduces implementation risk, maintenance burden, or security risk.
- Prefer Expo/RN-compatible libraries with active maintenance.
- Avoid packages that duplicate platform or existing helper behavior.
- Provider SDKs should not bypass existing service boundaries.

## Review Checklist

- What problem does this dependency solve?
- Can the repo solve it with existing tools?
- What is the bundle/runtime impact?
- What permissions, network calls, or data access does it add?
- How will it be updated or removed?

## Owners

- Package policy: [../architecture/DEPENDENCIES.md](../architecture/DEPENDENCIES.md)
- Security review: [../security/SECURITY.md](../security/SECURITY.md)
- Release checks: [../../operations/RELEASE.md](../../operations/RELEASE.md)

