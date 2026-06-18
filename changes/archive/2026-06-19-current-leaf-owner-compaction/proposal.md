# current-leaf-owner-compaction Proposal

Status: authoring
Branch: cleanup/v22-current-leaf-owner-compaction
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL governance
Affected plane: Framework

## Why

`tests/fixtures/v22/goal-current.json` still duplicated large owner payloads under `current_leaf` after the first machine cursor compaction. The leaf should describe the current cursor boundary and verification commands, not carry full Package D readiness and production launch projections that already have top-level owner surfaces.

## Goals

- Remove duplicate `current_leaf.package_d_deploy_readiness_plan`.
- Remove duplicate `current_leaf.production_launch_goal_gap_map`.
- Migrate the only current consumer to the top-level Package D owner payload.
- Add a contract that prevents large owner payloads from returning under `current_leaf`.

## Non-Goals

- No removal of top-level Package D readiness or production launch owner payloads.
- No compaction of `agent-verify-manifest.json`, docs/specs, docs/history, Go handlers or workflow gate.
- No runtime behavior, cloud, deploy, kubectl, build/push or live-test change.

## Golden Path Impact

- no-impact: this package changes local machine cursor hygiene only.
- affected steps: verify current, future-authorized local gate, review gate.
- required golden path eval: no runtime golden path behavior changes; local verification uses `node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk --dry-run --json`.

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.

## Subscribed Truth

- docs/active/README.md
- docs/specs/README.md
- docs/evidence/README.md
- docs/policies/README.md
- specs/framework/spec.md
- tests/fixtures/v22/goal-current.json
