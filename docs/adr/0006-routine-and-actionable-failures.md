# ADR 0006: Routine And Actionable Failure Surfaces

Status: Accepted
Date: 2026-05-25
Owner: Product/Engineering

## Context

Routine failures had drifted across inline copy, alerts, and dismiss-only sheets, while some failed workflows genuinely need a user choice.

## Decision

Use `<ErrorMessage>` for routine load and mutation failures. Use `<RekkusActionSheet>` for failure feedback only when it offers an explicit recovery action such as retry or review.

## Consequences

- Accessibility, theme treatment, and recovery expectations stay predictable.
- Failure scanners can reject retired variants without blocking actionable workflows.

## Alternatives Considered

- Alerts or notice sheets for every failure: rejected because dismiss-only interruptions do not help users recover.

## Rollback Or Revisit Trigger

Revisit if a new failure flow requires richer recovery than an inline surface or short action list can provide.
