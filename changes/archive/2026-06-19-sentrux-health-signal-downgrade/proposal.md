# sentrux-health-signal-downgrade Proposal

Owner: MedOPL Platform
Affected plane: Framework

## Problem

Sentrux alignment is useful repo health context, but it is no longer the current product or platform truth gate. Keeping `sentrux-v22-rules-alignment` in `changes/active` and in the current verify bundle makes a structural diagnostic look like an active platform blocker.

## Golden Path Impact

preserves golden path eval by removing a non-product health signal from the current active truth path. Golden path eval remains `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk`.

## Authorization Boundary

This package does not modify `.sentrux/*`, does not run Sentrux, and does not authorize deploy, kubectl, build/push, live-test, secret reads or true cloud calls.

## Non-Goals

- Do not delete `.sentrux/rules.toml`.
- Do not claim repo health proves runtime, billing, deploy or production readiness.
- Do not add a compatibility alias for the retired Sentrux contract test.
