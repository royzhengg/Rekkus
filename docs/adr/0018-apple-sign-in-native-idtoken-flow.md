# ADR 0018: Apple Sign-In via Native expo-apple-authentication + signInWithIdToken

Status: Accepted  
Date: 2026-06-13  
Owner: Engineering

## Context

App Store guideline 4.8 requires Sign in with Apple in any app that offers third-party social login (Rekkus already has Google OAuth). Without it the app cannot pass review.

Two implementation paths exist:
1. **Supabase web OAuth redirect** — same pattern as Google (`supabase.auth.signInWithOAuth({ provider: 'apple' })`), opens `expo-web-browser`, redirects back via deep link.
2. **Native `expo-apple-authentication` + `signInWithIdToken`** — calls the iOS-native Apple authentication sheet; passes the resulting identity token directly to Supabase without a browser popup.

## Decision

Use the native path (`expo-apple-authentication` + `supabase.auth.signInWithIdToken`).

## Consequences

- Apple sign-in is iOS-only. No Android change needed; Android users continue with Google/email.
- Native Apple sheet UX (no browser popup) satisfies Apple HIG requirements.
- SHA-256 nonce is generated with `expo-crypto` (already in the project), embedded in the identity JWT by Apple, and verified by Supabase against Apple's public JWKS. No Apple private key or client secret is required for the native flow.
- Account linking from ConnectedAccountsScreen uses `supabase.auth.linkIdentity({ provider: 'apple' })` which opens a web browser — there is no native linking API.
- Apple may return a private relay ("Hide My Email") address. Supabase stores whatever Apple returns; downstream linking uses `user.identities`, not the email field.
- `supabase/config.toml` requires `enabled = true` and `client_id = <bundle-id>` for local dev; production requires the same in the Supabase dashboard. The `secret` (Apple private key JWT) is only needed if the web OAuth redirect path is ever added.

## Alternatives Considered

- **Web OAuth redirect (same as Google)**: opens `expo-web-browser`, worse UX on iOS, may not satisfy Apple HIG button requirements. Chosen against because native UX is required and the signInWithIdToken path is simpler.

## Rollback Or Revisit Trigger

- Apple deprecates or removes `ASAuthorizationAppleIDButton` / native sign-in APIs.
- Supabase drops `signInWithIdToken` support for Apple.
- A cross-platform (iOS + Android) Apple Sign-In requirement emerges (Apple supports Android via web OAuth; would require the web OAuth path).
