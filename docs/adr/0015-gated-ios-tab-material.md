# ADR 0015: Gated iOS Tab Material

Status: Accepted
Date: 2026-05-27
Owner: Product Engineering

## Context

Apple material styling may make destination navigation feel more native on iPhone, but the app already has a cross-platform destination-only tab contract with a separate floating Create action. Expo Router native tabs and glass-effect adoption would expand migration and maintenance risk before there is physical-device evidence for the visual benefit.

## Decision

- Evaluate an iOS tab-bar material treatment on the existing JavaScript tab navigator using the already installed `expo-blur`.
- Gate the treatment with `iosTabBarMaterial`, off by default and eligible only in development and staging.
- Keep Android, beta, production, disabled-flag, and iOS Reduce Transparency paths on the opaque tab bar.
- Keep Feed, Search, Saved, and Profile as visible destinations and keep Create as the existing floating action.
- Use a reactive feature-flag read for rendered persistent chrome so an audited runtime disable restores the opaque bar without relaunch.

## Consequences

- The prototype is reversible without a navigation migration or new dependency.
- Absolute-positioned material chrome requires tab-coordinator content clearance.
- Promotion remains blocked until physical-iPhone evidence covers Reduce Transparency alongside existing accessibility dimensions.

## Rollback Or Revisit Trigger

Set `iosTabBarMaterial=false` through `feature_flag_overrides` and verify the opaque tab bar reappears within the refresh interval. Revisit native tabs or additional material surfaces only under separately scoped work with Android and accessibility evidence.
