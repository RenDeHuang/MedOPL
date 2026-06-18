# current-leaf-owner-compaction-closeout-sync Proposal

Status: authoring
Branch: recovery/platform-v22-trunk
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Framework
Affected plane: Framework

## Why

The `cleanup/v22-current-leaf-owner-compaction` package landed on trunk and reduced the machine cursor fixture, but post-merge closeout metadata still needed to point at that landed cleanup package.

## Goals

- Record the landed cleanup package in history.
- Sync active, delivery and machine cursor landed pointers.
- Preserve the current runtime/product blocker instead of accepting the stale closeout template text.
- Fix the closeout gate so cleanup landed commits may be followed by closeout-only commits without impossible self-reference.

## Non-Goals

- Do not add another machine cursor cleanup beyond the already landed package.
- Do not change runtime behavior, deployment behavior, cloud state, billing or production readiness.

## Golden Path Impact

- no-impact: this only reconciles cleanup landing closeout metadata.
- affected steps: docs lifecycle and landing closeout cursor.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk`

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.

## Subscribed Truth

- docs/active/README.md
- docs/delivery/README.md
- docs/history/README.md
- tests/fixtures/v22/goal-current.json
- specs/framework/spec.md
