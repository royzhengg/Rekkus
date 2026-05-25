# ADR 0010: Async Query Ownership

Status: Accepted
Date: 2026-05-25
Owner: Engineering

## Context

Screens and presentation components that own async queries accumulate duplicated loading/error handling and stale-response risks.

## Decision

Hooks and services own async query orchestration, returning loading, data, and error state with unmount or superseded-request cleanup. Presentation components render that contract.

## Consequences

- Cancellation, retry, and failure handling have testable ownership boundaries.
- Shared UI remains presentation-focused rather than a second service layer.

## Alternatives Considered

- Fetching directly in reusable components: rejected because it duplicates orchestration and increases race-condition surface.

## Rollback Or Revisit Trigger

Revisit only if a framework-level query layer replaces these hook/service responsibilities consistently.
