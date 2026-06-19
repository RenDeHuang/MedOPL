Owner: `MedOPL Platform`
Purpose: `spec_delta`
State: `archived_change`
Machine boundary: Durable spec sync target is `specs/framework/spec.md`, `specs/operations/spec.md` and `specs/runtime/spec.md`.

# repo-governance-closeout Spec Delta

Target specs:

- specs/framework/spec.md
- specs/operations/spec.md
- specs/runtime/spec.md

## ADDED

- `framework:repo-health-contraction`: repo governance must keep `scripts/` as the long-lived v22 control-plane surface, with repo bloat, line budget, cleanup lifecycle and Sentrux checks as structural proof.

## MODIFIED

- `operations:tke-bootstrap-preflight`: source surface moves from `scripts/v22-tke-bootstrap-preflight-plan.mjs` to `tests/support/cloud-prework/v22-tke-bootstrap-preflight-plan.js`.
- `operations:package-c-dry-run-create-release-plan`: source surface moves from `scripts/v22-tencent-create-release-dry-run-plan.mjs` to `tests/support/cloud-prework/v22-tencent-create-release-dry-run-plan.js`.
- `runtime:cloud-foundation-preflight`: source surface moves from `scripts/v22-tke-bootstrap-preflight-plan.mjs` to `tests/support/cloud-prework/v22-tke-bootstrap-preflight-plan.js`.

## REMOVED

- Temporary cloud-prework executables no longer live under `scripts/`.

## CANNOT-CLAIM

- Repo health contraction does not prove production readiness, real-cloud readiness, deploy authorization, kubectl authorization, build/push authorization or live-test authorization.
- Moving files under `tests/support/cloud-prework/` does not authorize reading secrets or calling Tencent Cloud.

## EVALS

- `node tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs`
- `node tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-live-runner-local-gate.mjs`
- `node tests/cloud/cloud-test-v22-tencent-resource-lifecycle-dry-run-plan-local-gate.mjs`
- `node tests/cloud/cloud-test-v22-tke-bootstrap-preflight-local-gate.mjs`
- `npm run repo:bloat`
- `npm run verify`
