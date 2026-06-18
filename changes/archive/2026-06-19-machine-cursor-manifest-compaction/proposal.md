# machine-cursor-manifest-compaction Proposal

Status: authoring
Branch: cleanup/v22-machine-cursor-manifest-compaction
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL governance
Affected plane: Framework

## Why

`tests/fixtures/v22/goal-current.json` is the machine cursor, but it has grown past 12000 lines because release readiness, current leaf and top-level current truth repeat large Package D and production launch projections. This package starts the cleanup at the highest-leverage safe point: remove duplicate release readiness payloads and add a contract that prevents them from returning.

## Goals

- Keep `release_readiness_state` as a compact gating object.
- Keep canonical large Package D and production launch projections only at their owner surfaces.
- Register a machine cursor compaction contract in the test lane registry and verify manifest.
- Avoid moving deleted payloads into another large archive fixture.

## Non-Goals

- No full rewrite of `goal-current.json`.
- No compaction of `docs/specs/README.md` or `docs/history/README.md`.
- No Go handler split.
- No workflow gate module split.
- No real cloud, deploy, kubectl, build/push or live-test.

## Golden Path Impact

- no-impact: this package changes local machine cursor hygiene only.
- affected steps: verify current, local contract, review gate.
- required golden path eval: no runtime golden path behavior changes; local verification uses `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --dry-run --json`.

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.

## Subscribed Truth

- docs/active/README.md
- docs/specs/README.md
- docs/evidence/README.md
- docs/policies/README.md
