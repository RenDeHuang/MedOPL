Owner: `MedOPL`
Purpose: `spec_delta`
State: `archived_change`
Machine boundary: Accepted deltas must be synchronized into `specs/operations/spec.md`, `specs/runtime/spec.md` and `docs/specs/README.md`.

# TKE Bootstrap Preflight Spec Delta

## ADDED

- `operations:tke-bootstrap-preflight` in `specs/operations/spec.md`.
- `runtime:cloud-foundation-preflight` in `specs/runtime/spec.md`.
- `spec:v22-tke-bootstrap-preflight-boundary` in `docs/specs/README.md`.

The added boundary defines a local dry-run preflight that describes the required TKE foundation before Package C live create/release can be requested.

## MODIFIED

- The cloud onboarding workflow in `docs/specs/README.md` now separates Package C dry-run planning from cloud foundation bootstrap preflight and later live mutation authorization.
- The production cloud topology reading path now names platform service pool, shared user compute pool and premium dedicated pool timing explicitly.

## REMOVED

- No source owner, deploy config, cloud adapter, infra path, kubectl path, secret path or upstream path is removed by this package.

## CANNOT-CLAIM

- This package cannot claim TKE, node pool, NAT, CBS, COS, PostgreSQL, namespace or workload creation.
- This package cannot claim production cloud readiness, deploy readiness, Package C live mutation authorization or real billing readiness.
- This package cannot claim Redis is required; Redis remains non-required for the current production data plane.

## EVALS

- `node tests/cloud/cloud-test-v22-tke-bootstrap-preflight-local-gate.mjs`
- `node scripts/v22-verify.mjs suite cloud-future-authorized --base origin/recovery/platform-v22-trunk`
