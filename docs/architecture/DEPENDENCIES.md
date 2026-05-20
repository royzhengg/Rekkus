# Dependency Governance

Owner: Engineering

Dependencies are product surface area: they affect security, build time, bundle size, and maintenance.

## Add Policy

Before adding a package, confirm:

- Existing repo code or platform APIs cannot reasonably solve the problem.
- The package is maintained and compatible with Expo/React Native.
- The bundle, native-module, and security cost are acceptable.
- The package does not duplicate an existing dependency.

## Audit Policy

- `npm run check:deps` runs `npm audit --audit-level=moderate`.
- `npm run check:ops` reports direct dependency counts.
- Release readiness should review dependency changes when provider, auth, storage, or native modules are touched.
- Dependabot is the preferred first automation for npm/package-lock updates and security alerts; Renovate should wait until dependency volume or grouping needs exceed Dependabot.
- SBOM generation is deferred until beta/prod release packaging needs an artifact, then prefer a GitHub-native or npm-compatible CycloneDX output over a custom script.
- License scanning should start as a release review of new direct dependencies; add automated scanning only when a non-standard license enters the tree or distribution risk increases.

## Messaging Dependency Note

`expo-video` and `expo-av` were added for video playback and audio recording in direct messages. Both are Expo first-party packages (MIT license, maintained by Expo). If WebRTC or a realtime media streaming library is added in future (V3 voice/video calls — see B-447), it must pass the full dependency policy review before merging, including native module audit and bundle-size impact assessment.

## Static Security Scanning

- Use GitHub-native secret scanning and Dependabot alerts where available before adding a noisy third-party scanner.
- Evaluate CodeQL for JavaScript/TypeScript once the GitHub workflow is stable.
- Evaluate Semgrep only if CodeQL misses a concrete Expo/Supabase security pattern we need.
- Findings must not store secrets, private payloads, or user data in issue text.
- Moderate-or-higher dependency findings block release unless a documented Expo/runtime constraint makes the fix unsafe.
- Dependency, SBOM, vulnerability, and license artifacts must not include secrets, private user payloads, or raw environment files.

## Ownership

- Runtime dependencies need a clear owner and feature reason.
- Dev dependencies need a clear check, build, or automation reason.
- Deprecated or unused dependencies should become backlog debt instead of silent drift.
