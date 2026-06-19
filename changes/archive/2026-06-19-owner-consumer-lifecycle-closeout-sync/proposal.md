# owner-consumer-lifecycle-closeout-sync Proposal

Status: archived
Branch: recovery/platform-v22-trunk
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Framework
Affected plane: Framework

## Why

The `cleanup/v22-owner-consumer-lifecycle-gates` branch landed and was pushed, remote branches were retired, and local stale worktrees were cleaned. The machine cursor still pointed at the previous landed closeout, and the closeout automation still assumed landed branch refs must remain locally available after cleanup.

## Goals

- Sync active, delivery, history and machine cursor pointers to the landed owner-consumer lifecycle cleanup commit.
- Keep landed branch names as provenance labels, not required long-lived local refs.
- Preserve the current product truth: MedOPL provides platform-managed OPL runtime/cloud/file/billing/audit service and does not own OPL research capability quality.
- Record local worktree/branch cleanup in the closeout metadata.

## Non-Goals

- Do not add runtime, billing, cloud, deploy or production readiness behavior.
- Do not restore deleted remote branches or keep compatibility refs.
- Do not claim real-cloud authorization is complete.

## Golden Path Impact

- no-impact: this reconciles governance closeout metadata and local cleanup state.
- affected steps: docs lifecycle, landing closeout cursor and closeout automation.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk`

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.

## Subscribed Truth

- docs/active/README.md
- docs/delivery/README.md
- docs/history/README.md
- docs/specs/README.md
- specs/framework/spec.md
- tests/fixtures/v22/goal-current.json
