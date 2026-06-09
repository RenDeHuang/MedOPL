Owner: `MedOPL`
Purpose: `spec_delta`
State: `active_change`
Machine boundary: `real-cloud-readiness` manifest membership and runner behavior are machine-readable.

# Spec Delta

## Target Specs

- `spec:v22-tencent-readonly-inventory-boundary`
- `spec:v22-production-cloud-topology-boundary`
- `specs/operations/spec.md`
- `specs/runtime/spec.md`

`spec:v22-tencent-readonly-inventory-boundary` gains a minimal active runner local gate:

- `scripts/v22-tencent-readonly-inventory-runner.mjs`.
- `tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-live-runner-local-gate.mjs`.

This does not change Package C or Package D:

- readonly inventory remains separate from create/release.
- mutation secret and deploy secret remain forbidden in the readonly runner.
- kubectl, build/push and deploy remain unauthorized.

Current live readiness state:

- local runner gate is implemented.
- official SDK cloud calls are not implemented in this package.
- missing SDK dependencies produce a redacted blocker report instead of a false success.

## CANNOT-CLAIM

- live Tencent inventory completed.
- real TKE / COS / billing inventory evidence exists.
- production cloud is online.
- create/release or deploy is authorized.
