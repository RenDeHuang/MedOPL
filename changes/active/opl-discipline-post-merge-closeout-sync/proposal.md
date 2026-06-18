# opl-discipline-post-merge-closeout-sync Proposal

Status: authoring
Branch: chore/v22-opl-discipline-post-merge-closeout
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Framework
Affected plane: Framework

## Why

The OPL-style development discipline package was ff-only landed and pushed to trunk, but the post-merge closeout cursor still pointed at the previous landed run.

## Goals

- Record the landed governance package in history.
- Sync active, delivery and machine cursor pointers to the landed commit.
- Preserve the current runtime/product blocker instead of replacing it with a stale closeout template.

## Non-Goals

- Do not clean up large fixtures, docs, Go handlers or workflow scripts in this closeout sync.
- Do not change runtime behavior, deployment behavior, cloud state, billing or production readiness.

## Golden Path Impact

- no-impact: this only reconciles governance closeout metadata.
- affected steps: docs lifecycle and landing closeout cursor.
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
