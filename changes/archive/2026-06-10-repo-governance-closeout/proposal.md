Owner: `MedOPL Platform`
Purpose: `proposal`
State: `archived_change`
Machine boundary: This package documents repository governance closeout only. Machine truth remains source, tests, fixtures, specs and runner behavior.

# repo-governance-closeout Proposal

Status: archived
Branch: cleanup/v22-governance-closeout
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Platform
Affected plane: Framework

## Why

The recovery trunk has the right real-cloud authorization boundary, but the latest cloud prework left temporary Tencent/TKE runner files in `scripts/`. That violates the repo's code cleanup and bloat budgets: `scripts/` must stay the long-lived v22 control-plane surface.

## Goals

- Move Package B/C/TKE pre-cloud support out of `scripts/` into a narrower cloud-prework owner surface.
- Keep readonly inventory, Package C dry-run and TKE bootstrap preflight proof runnable.
- Sync docs/specs/tests so the lifecycle owner reflects the new tool boundary.
- Restore `npm run repo:bloat`, cleanup lifecycle and default verify gates.

## Non-Goals

- No secret read.
- No real cloud operation.
- No Package C mutation, Package D deploy, kubectl, build/push or live-test.
- No new product capability.

## Golden Path Impact

- preserves: golden path behavior is unchanged; this package only contracts repo governance and cloud-prework support placement.
- affected steps: repo governance and real-cloud prework only.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk`

## Authorization Boundary

- No secret read unless explicitly authorized.
- No real cloud, deploy, kubectl, build/push or live-test unless explicitly authorized.

## Subscribed Truth

- docs/active/README.md
- docs/specs/README.md
- docs/framework/README.md
- docs/evidence/README.md
- docs/policies/README.md
