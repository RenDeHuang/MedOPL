# portal-opl-refund-api-fix Proposal

Status: archived
Branch: fix/v22-portal-opl-refund-api
Base trunk: origin/recovery/platform-v22-trunk
Owner: MedOPL Platform
Affected plane: Product + Integration + Operations

## Why

Local Portal testing found two product blockers: the Gateway direct-entry return path `/portal/opl` could render the React Router default 404, and Portal admin refund actions increased the local balance instead of recording a debit.

## Goals

- Route `/portal/opl` to the canonical OPL entry surface.
- Make OPL entry preflight check provider binding before creating a launch.
- Make refund ledger entries negative and reduce local Portal balance.
- Extend local regression coverage for the route alias and refund semantics.

## Non-Goals

- Do not read secrets or provider credentials.
- Do not modify one-person-lab upstream.
- Do not call real cloud, real provider APIs, deploy, kubectl, build/push or live-test.
- Do not claim production runtime, production billing or real cloud readiness.

## Golden Path Impact

- improves: local user path from Portal/Gateway return to OPL entry and admin refund correctness.
- affected steps: `enter OPL`, `billing / audit`.
- required golden path eval: `node scripts/v22-verify.mjs suite golden-path --base origin/recovery/platform-v22-trunk --json`.

## Authorization Boundary

- No secret read.
- No real cloud, deploy, kubectl, build/push or live-test.
- Only local deterministic Go backend and Portal frontend evals are in scope.

## Subscribed Truth

- docs/active/README.md
- docs/specs/README.md
- docs/framework/README.md
- docs/evidence/README.md
- docs/delivery/README.md
- specs/runtime/spec.md
- specs/operations/spec.md
