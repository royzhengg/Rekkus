# ADR 0001: Compliance-First Provider And Data Usage

## Status

Accepted

## Context

Rekkus needs to become self-reliant while remaining legal, compliant, secure, and inspection-ready. Restaurant data, analytics, media, provider data, and release disclosures can create legal and security risk if provenance and retention are not explicit.

## Decision

Every risky data or provider change must document Compliance Impact before release. Rekkus-owned first-party data is canonical where possible. Provider data is source-attributed enrichment/fallback with cacheability, attribution, retention, deletion/export, and audit rules.

Automated checks enforce compliance owner docs, data inventory, RLS, audit coverage, provider boundaries, privacy release gates, and ISO evidence.

## Consequences

- New feature work may need docs and checks before code ships.
- Provider integrations must go through service boundaries.
- Google Places content is handled conservatively; Place IDs can identify records, but broader content is not treated as Rekkus-owned truth.
- Legal review remains human-owned, but repo evidence is easier to inspect.
